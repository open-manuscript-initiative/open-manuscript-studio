{
  line = $0
  sub(/\r$/, "", line)
  marker = line
  sub(/^[[:space:]]+/, "", marker)
  sub(/[[:space:]]+$/, "", marker)

  if (marker == begin) {
    if (inside || starts > 0) invalid = 1
    inside = 1
    starts += 1
    next
  }

  if (marker == end) {
    if (!inside) invalid = 1
    inside = 0
    ends += 1
    next
  }

  if (!inside) print line
}

END {
  if (invalid || inside || starts != ends || starts > 1) {
    print "Managed Nginx block markers are malformed or repeated." > "/dev/stderr"
    exit 1
  }
}
