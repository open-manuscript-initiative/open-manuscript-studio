<?php

/**
 * Build the disposable OJS/OMP workflow used by the Studio integration tests.
 *
 * The fixture deliberately uses PKP repositories, services and DAOs. It does
 * not write application tables directly and it never patches PKP core.
 */

use APP\core\Application;
use APP\facades\Repo;
use PKP\cliTool\CommandLineTool;
use PKP\core\Core;
use PKP\db\DAORegistry;
use PKP\reviewForm\ReviewFormElement;
use PKP\security\Role;
use PKP\security\Validation;
use PKP\submission\reviewAssignment\ReviewAssignment;
use PKP\submissionFile\SubmissionFile;
use PKP\userGroup\UserGroup;

require dirname(__FILE__) . '/bootstrap.php';

final class OmiIntegrationFixtureTool extends CommandLineTool
{
    private const LOCALE = 'en';
    private const CONTEXT_PATH = 'omi-e2e';
    private const PASSWORD = 'omi-test-user';
    private string $platform;
    private string $publicBaseUrl;
    private string $studioBaseUrl;
    private string $sharedSecret;
    private string $action;

    public function __construct(array $argv = [])
    {
        parent::__construct($argv);

        $this->platform = strtolower((string)($this->argv[0] ?? ''));
        $this->publicBaseUrl = rtrim((string)($this->argv[1] ?? ''), '/');
        $this->studioBaseUrl = rtrim((string)($this->argv[2] ?? ''), '/');
        $this->sharedSecret = (string)($this->argv[3] ?? '');
        $this->action = (string)($this->argv[4] ?? 'create');

        if (!in_array($this->platform, ['ojs', 'omp'], true)) {
            $this->fail('Platform must be ojs or omp.');
        }
        if (!$this->isHttpUrl($this->publicBaseUrl) || !$this->isHttpUrl($this->studioBaseUrl)) {
            $this->fail('Public PKP and Studio base URLs are required.');
        }
        if (!preg_match('/^[0-9a-f]{64}$/i', $this->sharedSecret)) {
            $this->fail('The shared integration secret must contain exactly 64 hexadecimal characters.');
        }
        if (!in_array($this->action, ['create', 'verify-review'], true)) {
            $this->fail('Action must be create or verify-review.');
        }
    }

    public function execute(): void
    {
        $existing = Application::getContextDAO()->getByPath(self::CONTEXT_PATH);
        if ($this->action === 'verify-review') {
            if (!$existing) $this->fail('The workflow fixture context does not exist.');
            $stored = $this->loadStoredFixture((int)$existing->getId());
            if ($stored === null) $this->fail('The workflow fixture metadata does not exist.');
            $this->verifyReviewWriteback($stored);
            return;
        }
        if ($existing) {
            $stored = $this->loadStoredFixture((int)$existing->getId());
            if ($stored !== null) {
                $this->writeJson($stored);
                return;
            }
            $this->fail('The fixture context exists without reusable fixture metadata. Run pkp:down first.');
        }

        $context = $this->createContext();
        $contextId = (int)$context->getId();

        $groups = [
            'editor' => $this->getDefaultUserGroup($contextId, Role::ROLE_ID_MANAGER),
            'author' => $this->getDefaultUserGroup($contextId, Role::ROLE_ID_AUTHOR),
            'reviewer' => $this->getDefaultUserGroup($contextId, Role::ROLE_ID_REVIEWER),
        ];

        $users = [
            'editor' => $this->createUser('omi-editor', 'Editorial', 'Manager', 'editor@example.test', $groups['editor']),
            'author' => $this->createUser('omi-author', 'Hidden', 'Author', 'hidden.author@example.test', $groups['author']),
            'reviewer' => $this->createUser('omi-reviewer', 'Anonymous', 'Reviewer', 'reviewer@example.test', $groups['reviewer']),
        ];

        $submission = $this->createSubmission($context, $users['author'], $groups['author']);
        $submissionId = (int)$submission->getId();
        Repo::stageAssignment()->build($submissionId, $groups['editor']->id, (int)$users['editor']->getId());
        Repo::stageAssignment()->build($submissionId, $groups['author']->id, (int)$users['author']->getId());

        $component = $this->platform === 'omp'
            ? $this->createOmpChapters($submission)
            : null;
        $reviewForm = $this->createReviewForm($context);

        $sourceFileId = $this->createSubmissionFile(
            $contextId,
            $submissionId,
            (int)$users['author']->getId(),
            'review-source.docx',
            'Assignment-scoped manuscript body. The reviewer can inspect this article.',
            $component['assignedId'] ?? null
        );
        $forbiddenFileId = $this->createSubmissionFile(
            $contextId,
            $submissionId,
            (int)$users['author']->getId(),
            'unassigned-source.docx',
            'UNASSIGNED CHAPTER SENTINEL. This text must never reach the reviewer.',
            $component['unassignedId'] ?? null
        );

        $reviewAssignment = $this->createReviewAssignment(
            $submissionId,
            (int)$users['reviewer']->getId(),
            $reviewForm['formId']
        );
        $reviewFilesDao = DAORegistry::getDAO('ReviewFilesDAO');
        $reviewFilesDao->grant((int)$reviewAssignment->getId(), $sourceFileId);

        $installationId = 'omi-e2e-' . $this->platform;
        $this->configurePlugin($contextId, $installationId);

        $fixture = [
            'platform' => $this->platform,
            'publicBaseUrl' => $this->publicBaseUrl,
            'studioBaseUrl' => $this->studioBaseUrl,
            'installationId' => $installationId,
            'context' => [
                'id' => (string)$contextId,
                'path' => self::CONTEXT_PATH,
                'name' => $this->platform === 'ojs' ? 'OMI Integration Journal' : 'OMI Integration Press',
            ],
            'submission' => [
                'id' => (string)$submissionId,
                'title' => $this->platform === 'ojs'
                    ? 'Reviewer-visible OJS article'
                    : 'Parent monograph title must stay hidden',
            ],
            'component' => $component,
            'reviewAssignmentId' => (string)$reviewAssignment->getId(),
            'reviewForm' => [
                'elementId' => (string)$reviewForm['elementId'],
                'response' => 'Native PKP review form response from Studio.',
            ],
            'sourceFileId' => (string)$sourceFileId,
            'forbiddenFileId' => (string)$forbiddenFileId,
            'users' => [
                'editor' => $this->userFixture($users['editor']),
                'author' => $this->userFixture($users['author']),
                'reviewer' => $this->userFixture($users['reviewer']),
            ],
            'authorIdentitySentinels' => [
                'Hidden Author',
                'hidden.author@example.test',
            ],
            'contentSentinels' => [
                'assigned' => 'Assignment-scoped manuscript body',
                'forbidden' => 'UNASSIGNED CHAPTER SENTINEL',
            ],
        ];

        $this->storeFixture($contextId, $fixture);
        $this->writeJson($fixture);
    }

    private function createContext(): object
    {
        $context = Application::getContextDAO()->newDataObject();
        $name = $this->platform === 'ojs' ? 'OMI Integration Journal' : 'OMI Integration Press';
        $context->setAllData([
            'urlPath' => self::CONTEXT_PATH,
            'name' => [self::LOCALE => $name],
            'acronym' => [self::LOCALE => 'OMI E2E'],
            'primaryLocale' => self::LOCALE,
            'supportedLocales' => [self::LOCALE],
            'supportedFormLocales' => [self::LOCALE],
            'supportedDefaultSubmissionLocale' => self::LOCALE,
            'supportedAddedSubmissionLocales' => [self::LOCALE],
            'supportedSubmissionLocales' => [self::LOCALE],
            'supportedSubmissionMetadataLocales' => [self::LOCALE],
            'contactName' => 'OMI Integration Administrator',
            'contactEmail' => 'admin@example.test',
            'enabled' => true,
        ]);

        return app()->get('context')->add($context, Application::get()->getRequest());
    }

    private function getDefaultUserGroup(int $contextId, int $roleId): UserGroup
    {
        $group = UserGroup::withContextIds([$contextId])
            ->withRoleIds([$roleId])
            ->isDefault(true)
            ->first();

        if (!($group instanceof UserGroup)) {
            $this->fail("Default user group for role {$roleId} was not installed.");
        }
        return $group;
    }

    private function createUser(
        string $username,
        string $givenName,
        string $familyName,
        string $email,
        UserGroup $group
    ): object {
        $user = Repo::user()->newDataObject();
        $user->setUsername($username);
        $user->setPassword(Validation::encryptCredentials($username, self::PASSWORD));
        $user->setGivenName($givenName, self::LOCALE);
        $user->setFamilyName($familyName, self::LOCALE);
        $user->setEmail($email);
        $user->setDateRegistered(Core::getCurrentDate());
        $user->setInlineHelp(1);
        $user->setDisabled(false);
        Repo::user()->add($user);
        Repo::userGroup()->assignUserToGroup((int)$user->getId(), (int)$group->id);
        return $user;
    }

    private function createSubmission(object $context, object $authorUser, UserGroup $authorGroup): object
    {
        $title = $this->platform === 'ojs'
            ? 'Reviewer-visible OJS article'
            : 'Parent monograph title must stay hidden';
        $publicationData = [
            'title' => [self::LOCALE => $title],
            'subtitle' => [self::LOCALE => 'PARENT METADATA SENTINEL'],
            'abstract' => [self::LOCALE => 'PARENT ABSTRACT SENTINEL'],
            'status' => 1,
        ];

        if ($this->platform === 'ojs') {
            $section = Repo::section()->getCollector()
                ->filterByContextIds([(int)$context->getId()])
                ->getMany()
                ->first();
            if (!$section) {
                $this->fail('The default OJS section was not created.');
            }
            $publicationData['sectionId'] = (int)$section->getId();
        }

        $submission = Repo::submission()->newDataObject([
            'contextId' => (int)$context->getId(),
            'locale' => self::LOCALE,
            'stageId' => WORKFLOW_STAGE_ID_EXTERNAL_REVIEW,
            'status' => 1,
            'submissionProgress' => 0,
            'dateSubmitted' => Core::getCurrentDate(),
        ]);
        $publication = Repo::publication()->newDataObject($publicationData);
        $submissionId = Repo::submission()->add($submission, $publication, $context);
        $submission = Repo::submission()->get($submissionId);
        $publication = $submission?->getCurrentPublication();
        if (!$submission || !$publication) {
            $this->fail('PKP failed to create the workflow submission.');
        }

        $author = Repo::author()->newAuthorFromUser($authorUser, $submission, $context);
        $author->setData('publicationId', (int)$publication->getId());
        $author->setData('userGroupId', (int)$authorGroup->id);
        $author->setData('seq', 0);
        $author->setData('primaryContact', true);
        $authorId = Repo::author()->add($author);
        Repo::publication()->edit($publication, ['primaryContactId' => $authorId]);

        return Repo::submission()->get($submissionId);
    }

    private function createOmpChapters(object $submission): array
    {
        $publication = $submission->getCurrentPublication();
        if (!$publication) {
            $this->fail('The OMP publication was not created.');
        }
        $chapterDao = DAORegistry::getDAO('ChapterDAO');
        $assigned = $chapterDao->newDataObject();
        $assigned->setData('publicationId', (int)$publication->getId());
        $assigned->setSequence(1);
        $assigned->setTitle('Assigned OMP study', self::LOCALE);
        $assigned->setSubtitle('Article-level subtitle', self::LOCALE);
        $assigned->setAbstract('Article-level abstract', self::LOCALE);
        $assignedId = $chapterDao->insertChapter($assigned);

        $unassigned = $chapterDao->newDataObject();
        $unassigned->setData('publicationId', (int)$publication->getId());
        $unassigned->setSequence(2);
        $unassigned->setTitle('Unassigned OMP study', self::LOCALE);
        $unassigned->setAbstract('UNASSIGNED CHAPTER METADATA SENTINEL', self::LOCALE);
        $unassignedId = $chapterDao->insertChapter($unassigned);

        $author = Repo::author()->getCollector()
            ->filterByPublicationIds([(int)$publication->getId()])
            ->getMany()
            ->first();
        if ($author) {
            Repo::author()->addToChapter((int)$author->getId(), $assignedId, true, 0);
            Repo::author()->addToChapter((int)$author->getId(), $unassignedId, true, 0);
        }

        return [
            'assignedId' => (string)$assignedId,
            'assignedTitle' => 'Assigned OMP study',
            'unassignedId' => (string)$unassignedId,
            'unassignedTitle' => 'Unassigned OMP study',
        ];
    }

    private function createSubmissionFile(
        int $contextId,
        int $submissionId,
        int $uploaderUserId,
        string $name,
        string $body,
        ?string $componentId
    ): int {
        $temporaryPath = $this->createDocx($name, $body);
        $submissionDir = Repo::submissionFile()->getSubmissionDir($contextId, $submissionId);
        $fileId = app()->get('file')->add(
            $temporaryPath,
            $submissionDir . '/' . uniqid('omi-e2e-', true) . '.docx'
        );
        @unlink($temporaryPath);

        $genreDao = DAORegistry::getDAO('GenreDAO');
        $genres = $genreDao->getEnabledByContextId($contextId);
        $genre = null;
        while ($candidate = $genres->next()) {
            if (strtoupper((string)$candidate->getKey()) === 'SUBMISSION') {
                $genre = $candidate;
                break;
            }
            $genre ??= $candidate;
        }

        $stored = app()->get('file')->get($fileId);
        if (!$stored) {
            $this->fail('PKP did not retain the generated DOCX fixture.');
        }
        $submissionFile = Repo::submissionFile()->newDataObject([
            'fileId' => $fileId,
            'fileStage' => SubmissionFile::SUBMISSION_FILE_SUBMISSION,
            'name' => [self::LOCALE => $name],
            'submissionId' => $submissionId,
            'uploaderUserId' => $uploaderUserId,
            'genreId' => $genre ? (int)$genre->getId() : null,
            'originalFileName' => $name,
            'mimetype' => $stored->mimetype ?? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'fileSize' => app()->get('file')->fs->fileSize($stored->path),
            'revision' => 1,
            ...($componentId !== null ? ['chapterId' => (int)$componentId] : []),
        ]);

        return Repo::submissionFile()->add($submissionFile);
    }

    private function createReviewForm(object $context): array
    {
        /** @var \PKP\reviewForm\ReviewFormDAO $formDao */
        $formDao = DAORegistry::getDAO('ReviewFormDAO');
        $form = $formDao->newDataObject();
        $form->setAssocType((int)$context->getAssocType());
        $form->setAssocId((int)$context->getId());
        $form->setSequence(1);
        $form->setActive(true);
        $form->setTitle('OMI integration review form', self::LOCALE);
        $form->setDescription('Required native PKP writeback check.', self::LOCALE);
        $formId = $formDao->insertObject($form);

        /** @var \PKP\reviewForm\ReviewFormElementDAO $elementDao */
        $elementDao = DAORegistry::getDAO('ReviewFormElementDAO');
        $element = $elementDao->newDataObject();
        $element->setReviewFormId($formId);
        $element->setSequence(1);
        $element->setElementType(ReviewFormElement::REVIEW_FORM_ELEMENT_TYPE_TEXTAREA);
        $element->setRequired(true);
        $element->setIncluded(true);
        $element->setQuestion('What should the author revise?', self::LOCALE);
        $element->setDescription('This required answer is written back through the integration.', self::LOCALE);
        $elementId = $elementDao->insertObject($element);

        return ['formId' => $formId, 'elementId' => $elementId];
    }

    private function createReviewAssignment(
        int $submissionId,
        int $reviewerId,
        int $reviewFormId
    ): ReviewAssignment
    {
        $reviewRoundDao = DAORegistry::getDAO('ReviewRoundDAO');
        $round = $reviewRoundDao->build(
            $submissionId,
            WORKFLOW_STAGE_ID_EXTERNAL_REVIEW,
            1
        );
        if (!$round) {
            $this->fail('PKP failed to create the external review round.');
        }

        $assignment = Repo::reviewAssignment()->newDataObject([
            'submissionId' => $submissionId,
            'reviewerId' => $reviewerId,
            'dateAssigned' => Core::getCurrentDate(),
            'dateNotified' => Core::getCurrentDate(),
            'dateResponseDue' => date('Y-m-d H:i:s', strtotime('+7 days')),
            'dateDue' => date('Y-m-d H:i:s', strtotime('+14 days')),
            'stageId' => WORKFLOW_STAGE_ID_EXTERNAL_REVIEW,
            'round' => 1,
            'reviewRoundId' => (int)$round->getId(),
            'reviewMethod' => ReviewAssignment::SUBMISSION_REVIEW_METHOD_DOUBLEANONYMOUS,
            'reviewFormId' => $reviewFormId,
            'cancelled' => 0,
            'declined' => 0,
        ]);
        $assignmentId = Repo::reviewAssignment()->add($assignment);
        $stored = Repo::reviewAssignment()->get($assignmentId, $submissionId);
        if (!($stored instanceof ReviewAssignment)) {
            $this->fail('PKP failed to persist the review assignment.');
        }
        return $stored;
    }

    private function configurePlugin(int $contextId, string $installationId): void
    {
        $plugin = $this->integrationPlugin();
        $plugin->updateSetting($contextId, 'enabled', true, 'bool');
        $plugin->updateSetting($contextId, 'studioUrl', $this->studioBaseUrl, 'string');
        $plugin->updateSetting($contextId, 'installationId', $installationId, 'string');
        $plugin->updateSetting($contextId, 'sharedSecret', $this->sharedSecret, 'string');
        $plugin->updateSetting($contextId, 'tokenTtl', 900, 'int');
    }

    private function integrationPlugin(): object
    {
        require_once 'plugins/generic/studioIntegration/StudioIntegrationPlugin.php';
        $class = '\\APP\\plugins\\generic\\studioIntegration\\StudioIntegrationPlugin';
        return new $class();
    }

    private function createDocx(string $name, string $body): string
    {
        if (!class_exists(ZipArchive::class)) {
            $this->fail('The PKP image does not provide ZipArchive for the DOCX fixture.');
        }
        $path = tempnam(sys_get_temp_dir(), 'omi-e2e-docx-');
        if ($path === false) {
            $this->fail('Unable to allocate a temporary DOCX path.');
        }
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
            $this->fail('Unable to create the temporary DOCX fixture.');
        }
        $escape = static fn (string $value): string => htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            . '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            . '</Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            . '</Relationships>');
        $zip->addFromString('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>');
        $zip->addFromString('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            . '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
            . '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>'
            . '<w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>'
            . '</w:styles>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            . '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>' . $escape($name) . '</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>' . $escape($body) . '</w:t></w:r></w:p>'
            . '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
            . '</w:body></w:document>');
        $zip->close();
        return $path;
    }

    private function userFixture(object $user): array
    {
        return [
            'id' => (string)$user->getId(),
            'username' => (string)$user->getUsername(),
            'password' => self::PASSWORD,
            'email' => (string)$user->getEmail(),
            'fullName' => (string)$user->getFullName(),
        ];
    }

    private function storeFixture(int $contextId, array $fixture): void
    {
        $pluginSettingsDao = DAORegistry::getDAO('PluginSettingsDAO');
        $pluginSettingsDao->updateSetting(
            $contextId,
            $this->integrationPlugin()->getName(),
            'e2eFixture',
            json_encode($fixture, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'string'
        );
    }

    private function verifyReviewWriteback(array $fixture): void
    {
        $submissionId = (int)($fixture['submission']['id'] ?? 0);
        $assignmentId = (int)($fixture['reviewAssignmentId'] ?? 0);
        $reviewerId = (int)($fixture['users']['reviewer']['id'] ?? 0);
        if ($submissionId < 1 || $assignmentId < 1 || $reviewerId < 1) {
            $this->fail('Stored workflow fixture metadata is incomplete.');
        }

        $commentDao = DAORegistry::getDAO('SubmissionCommentDAO');
        $authorComment = $commentDao
            ->getReviewerCommentsByReviewerId($submissionId, $reviewerId, $assignmentId, true)
            ->next();
        $editorComment = $commentDao
            ->getReviewerCommentsByReviewerId($submissionId, $reviewerId, $assignmentId, false)
            ->next();
        $authorText = $authorComment ? (string)$authorComment->getComments() : '';
        $editorText = $editorComment ? (string)$editorComment->getComments() : '';
        if (!str_contains($authorText, 'Author-visible E2E review comment.')) {
            $this->fail('The author-visible Studio review comment was not written to PKP.');
        }
        if (!str_contains($editorText, 'Editor-only E2E review comment.')) {
            $this->fail('The editor-only Studio review comment was not written to PKP.');
        }
        if ($this->platform === 'ojs' && !str_contains($editorText, '[OMI recommendation: MINOR_REVISION]')) {
            $this->fail('The OJS recommendation was not written to the editor-only review comment.');
        }

        $reviewForm = is_array($fixture['reviewForm'] ?? null) ? $fixture['reviewForm'] : [];
        $elementId = (int)($reviewForm['elementId'] ?? 0);
        $expectedResponse = (string)($reviewForm['response'] ?? '');
        $responseDao = DAORegistry::getDAO('ReviewFormResponseDAO');
        $responseValues = $responseDao->getReviewReviewFormResponseValues($assignmentId);
        if ($elementId < 1 || $expectedResponse === '' || ($responseValues[$elementId] ?? null) !== $expectedResponse) {
            $this->fail('The Studio review-form response was not written to PKP.');
        }

        $this->writeJson([
            'platform' => $this->platform,
            'reviewAssignmentId' => (string)$assignmentId,
            'authorVisibleCommentWritten' => true,
            'editorOnlyCommentWritten' => true,
            'reviewFormResponseWritten' => true,
            'recommendationWritten' => $this->platform === 'ojs',
        ]);
    }

    private function loadStoredFixture(int $contextId): ?array
    {
        $pluginSettingsDao = DAORegistry::getDAO('PluginSettingsDAO');
        $value = $pluginSettingsDao->getSetting(
            $contextId,
            $this->integrationPlugin()->getName(),
            'e2eFixture'
        );
        if (!is_string($value) || $value === '') {
            return null;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function writeJson(array $value): void
    {
        $encoded = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            $this->fail('Unable to encode fixture metadata.');
        }
        fwrite(STDOUT, $encoded . PHP_EOL);
    }

    private function isHttpUrl(string $value): bool
    {
        $parts = parse_url($value);
        return is_array($parts)
            && in_array($parts['scheme'] ?? '', ['http', 'https'], true)
            && isset($parts['host']);
    }

    private function fail(string $message): never
    {
        fwrite(STDERR, 'OMI PKP fixture: ' . $message . PHP_EOL);
        exit(1);
    }
}

$tool = new OmiIntegrationFixtureTool($argv ?? []);
$tool->execute();
