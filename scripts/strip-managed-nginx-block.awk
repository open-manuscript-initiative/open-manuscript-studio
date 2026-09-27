{
  line = $0
  sub(/\r$/, "", line)
  marker = line
  sub(/^[[:space:]]+/, "", marker)
  sub(/[[:space:]]+$/, "", marker)

  if (marker == begin) {
    if (inside) invalid = 1
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
  if (invalid || inside || starts != ends) {
    print "Managed Nginx block markers are malformed." > "/dev/stderr"
    exit 1
  }
}
