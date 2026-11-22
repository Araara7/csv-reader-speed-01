// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program).
// Same answers as readCsv on every input: {columns, rows, errors}.
// Strategy: one pass, fields taken by slice (never built char by char).
// A record with no quote and no stray CR in its physical line is taken
// whole (slice + split). Everything else is scanned field by field with
// charCodeAt, slicing each field at its delimiter; quoted fields are
// located with indexOf and only transformed when they hold "" or CR.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;
  // Index of the next CR at or after pos, or len when there is none left.
  // Monotonic: pos only moves forward, so each search starts where the
  // last one left off and the total scan is linear.
  let nextCR = text.indexOf('\r', pos);
  if (nextCR === -1) nextCR = len;
  let nextLF = text.indexOf('\n', pos);
  if (nextLF === -1) nextLF = len;

  // Unquoted field scan from pos, appending onto `value`. Cold path
  // (unterminated-quote re-read, quote junk): the hot unquoted path is
  // inlined in the record loop below. Returns the field's ending:
  // 44 comma, 10 line break, 0 end of text.
  function scanUnquoted(value) {
    let start = pos;
    while (true) {
      if (pos >= len) return { value: value + text.slice(start, pos), ended: 0 };
      const c = text.charCodeAt(pos);
      if (c === 44) { const v = value + text.slice(start, pos); pos += 1; return { value: v, ended: 44 }; }
      if (c === 10) { const v = value + text.slice(start, pos); pos += 1; line += 1; return { value: v, ended: 10 }; }
      if (c === 13) {
        if (text.charCodeAt(pos + 1) === 10) {
          const v = value + text.slice(start, pos); pos += 2; line += 1; return { value: v, ended: 10 };
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        value += text.slice(start, pos);
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
  }

  let recordLine = 1;
  let recordRow = null;

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= len) break;
    recordLine = line;
    recordRow = (header && columns === null) ? null : rows.length;

    let fields = null;
    let noRecord = false;

    // ---- fast path: one physical line, no quote, no stray CR ----
    if (nextCR < pos) { nextCR = text.indexOf('\r', pos); if (nextCR === -1) nextCR = len; }
    const eol = text.indexOf('\n', pos);
    const lineEnd = eol === -1 ? len : eol;
    const q = text.indexOf('"', pos);
    if (q === -1 || q >= lineEnd) {
      if (nextCR >= lineEnd || (eol !== -1 && nextCR === lineEnd - 1)) {
        const end = (eol !== -1 && nextCR === lineEnd - 1) ? lineEnd - 1 : lineEnd;
        fields = text.slice(pos, end).split(',');
        pos = eol === -1 ? len : eol + 1;
        line += 1;
      }
    }

    // ---- slow path: field by field ----
    if (fields === null) {
      fields = [];
      let quoted = false;
      let done = false;
      while (!done) {
        let value;
        let ended;
        if (text.charCodeAt(pos) === 34) {
          quoted = true;
          const open = pos;
          const openLine = line;
          let i = open + 1;
          let hasDoubled = false;
          let closedAt = -1;
          while (true) {
            const qq = text.indexOf('"', i);
            if (qq === -1) break;
            if (text.charCodeAt(qq + 1) === 34) { hasDoubled = true; i = qq + 2; continue; }
            closedAt = qq;
            break;
          }
          if (closedAt === -1) {
            errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
            pos = open + 1;
            line = openLine;
            const r = scanUnquoted('"');
            fields.push(r.value);
            if (r.ended === 44) continue;
            done = true;
            continue;
          }
          // Line breaks inside the quotes: each LF, each CR not followed by LF.
          // The cached next LF/CR (refreshed below) already tell whether any
          // sits inside the field, so the counting loops only run for a
          // field that actually spans lines or holds a CR.
          if (nextLF < open) { nextLF = text.indexOf('\n', open); if (nextLF === -1) nextLF = len; }
          if (nextCR < open) { nextCR = text.indexOf('\r', open); if (nextCR === -1) nextCR = len; }
          let breaks = 0;
          const hasCR = nextCR < closedAt;
          if (nextLF < closedAt) {
            let ni = nextLF;
            while (true) {
              breaks += 1;
              ni = text.indexOf('\n', ni + 1);
              if (ni === -1 || ni >= closedAt) break;
            }
          }
          if (hasCR) {
            let ri = nextCR;
            while (true) {
              if (text.charCodeAt(ri + 1) !== 10) breaks += 1;
              ri = text.indexOf('\r', ri + 1);
              if (ri === -1 || ri >= closedAt) break;
            }
          }
          line += breaks;
          if (!hasDoubled && !hasCR) value = text.slice(open + 1, closedAt);
          else if (!hasCR) value = text.slice(open + 1, closedAt).replaceAll('""', '"');
          else if (!hasDoubled) value = text.slice(open + 1, closedAt).replace(/\r\n?/g, '\n');
          else value = text.slice(open + 1, closedAt).replaceAll('""', '"').replace(/\r\n?/g, '\n');
          pos = closedAt + 1;
          if (pos >= len) { fields.push(value); done = true; continue; }
          const c = text.charCodeAt(pos);
          if (c === 44) { pos += 1; fields.push(value); continue; }
          if (c === 10) { pos += 1; line += 1; fields.push(value); done = true; continue; }
          if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; fields.push(value); done = true; continue; }
          // Quote junk: what follows the closing quote, up to the next
          // comma or line break, is appended as it stands.
          const base = value.length;
          const r = scanUnquoted(value);
          if (r.value.length > base) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
          fields.push(r.value);
          if (r.ended === 44) continue;
          done = true;
          continue;
        }
        // Unquoted field: the end is the nearest of the next comma (indexOf),
        // the next LF and the next CR (both cached, monotonic, linear total).
        quoted = false;
        value = '';
        ended = 0;
        while (true) {
          if (nextLF < pos) { nextLF = text.indexOf('\n', pos); if (nextLF === -1) nextLF = len; }
          if (nextCR < pos) { nextCR = text.indexOf('\r', pos); if (nextCR === -1) nextCR = len; }
          let comma = text.indexOf(',', pos);
          if (comma === -1) comma = len;
          let end = comma < nextLF ? comma : nextLF;
          let isCR = false;
          if (nextCR < end) { end = nextCR; isCR = true; }
          if (end >= len) { value += text.slice(pos, len); pos = len; ended = 0; break; }
          if (isCR) {
            if (text.charCodeAt(end + 1) === 10) {
              value += text.slice(pos, end); pos = end + 2; line += 1; ended = 10; break;
            }
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            value += text.slice(pos, end);
            pos = end + 1;
            continue;
          }
          value += text.slice(pos, end);
          if (end === comma) { pos = end + 1; ended = 44; }
          else { pos = end + 1; line += 1; ended = 10; }
          break;
        }
        fields.push(value);
        if (ended === 44) continue;
        done = true;
      }
      // A line that held only stray CRs is left with no characters: no record.
      if (fields.length === 1 && fields[0] === '' && !quoted) noRecord = true;
    }

    if (noRecord) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
