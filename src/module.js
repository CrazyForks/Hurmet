import { dt } from "./constants.js"
import { tablessTrim } from "./utils.js"
import { valueFromLiteral } from "./literal"
import { arrayOfRegExMatches, isValidIdentifier } from "./utils"
import { parse } from "./parser.js"
import { errorOprnd } from "./error.js"

const keywordRegEx = /^(if|elseif|else|return|throw|while|for|break|print|end)(\u2002|\b)/
const drawCommandRegEx = /^(title|frame|view|axes|grid|stroke|strokewidth|strokedasharray|fill|fontsize|fontweight|fontstyle|fontfamily|marker|line|path|plot|curve|rect|circle|ellipse|arc|text|dot|leader|dimension)\b/
const leadingSpaceRegEx = /^[\t ]+/
const oneLinerRegEx = /^( *)if ([^\n`]+) +(return|throw|print|break)\b([^\n]+)?(?: end)? *\n/gm

// If you change functionRegEx, then also change it in mathprompt.js.
// It isn't called from there in order to avoid duplicating Hurmet code inside ProseMirror.js.
// eslint-disable-next-line max-len
export const functionRegEx = new RegExp("^function " + isValidIdentifier.source.slice(1, -1) + "\\(")
export const moduleRegEx = /^module ([A-Za-z][A-Za-z0-9]*)/
export const drawRegEx = /^draw\(/
const startSvgRegEx = /^startSvg\(\)/
const lexRegEx = /"[^"]*"|``.*|`[^`]*`|'[^']*'|#|[^"`'#]+/g

const testForStatement = str => {
  const pos = str.indexOf("=")
  if (pos === -1) { return false }
  const leadStr = str.slice(0, pos).replace(leadingSpaceRegEx, "").trim()
  if (isValidIdentifier.test(leadStr)) { return true }
  if (leadStr.indexOf(",") === -1) { return false }
  let result = true
  const arry = leadStr.split(",")
  arry.forEach(e => {
    if (!isValidIdentifier.test(e.trim())) { result = false }
  })
  return result
}

const stripComment = str => {
  // Strip the comment, if any, from the end of a code line.
  const matches = arrayOfRegExMatches(lexRegEx, str)
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].value === "#") {
      str = str.slice(0, matches[i].index)
      break
    }
  }
  return str.trim()
}

export const scanModule = (str, formats) => {
  // Scan the code and break it down into individual lines of code.
  // Assemble the lines into functions and assign each function to parent.
  const parent = Object.create(null)

  // Expand one-liners into if ... end blocks.
  str = str.replace(oneLinerRegEx, "$1if\u2002$2\n$1    $3\u2002$4\n$1end\n")

  // Statements end at a newline.
  const lines = str.split(/\r?\n/g)

  for (let i = 0; i < lines.length; i++) {
    // Get a single line of code and strip off any comments.
    const line = stripComment(lines[i])
    if (line.length === 0) { continue }

    if (functionRegEx.test(line) || drawRegEx.test(line)) {
      // This line starts a new function.
      const [funcObj, endLineNum] = scanFunction(lines, formats, i)
      if (funcObj.dtype && funcObj.dtype === dt.ERROR) { return funcObj }
      parent[funcObj.name] = funcObj
      i = endLineNum
    } else if (testForStatement(line)) {
      // This line starts a Hurmet assignment.
      const [stmt, endLineNum] = scanAssignment(lines, formats, i)
      parent[stmt.name] = stmt
      i = endLineNum
    }
  }
  return { value: parent, unit: null, dtype: dt.MODULE }

}

const handleTSV = (expression, lines, startLineNum) => {
  for (let i = startLineNum + 1; i < lines.length; i++) {
    const line = tablessTrim(lines[i])
    if (line.length === 0) { continue }
    expression += "\n" + line
    if (line.slice(-2) === "``") { return [expression, i] }
  }
}

const scanFunction = (lines, formats, startLineNum) => {
  const line1 = stripComment(lines[startLineNum])
  let isDraw = line1.charAt(0) === "d"
  const posParen = line1.indexOf("(")
  let functionName = ""
  if (isDraw) {
    functionName = "draw"
  } else {
    const posFn = line1.indexOf("function")
    functionName = line1.slice(posFn + 8, posParen).trim()
  }

  const parameterString =  line1.slice(posParen + 1, -1).trim()
  const parameterSplit = parameterString.length === 0 ? [] : parameterString.split(/ *[,;] */g)
  const parameters = [];
  for (const param of parameterSplit) {
    const parts = param.split(/ *= */)
    const name = parts[0]
    let defaultVal = { name, value: null, dtype: null }
    if (parts[1]) {
      const [value, unit, dtype, resultDisplay] = valueFromLiteral(parts[1], "", formats)
      defaultVal = { name, value, unit, dtype, resultDisplay }
    }
    parameters.push({ name, default: defaultVal })
  }

  const funcObj = {
    name: functionName,
    dtype: isDraw ? dt.DRAWING : dt.MODULE,
    parameters,
    statements: []
  }

  const stackOfCtrls = []
  let expression = ""
  let prevLineEndedInContinuation = false
  let prevLine = ""
  let name = ""
  let isStatement = false

  let j = startLineNum
  for (let i = startLineNum + 1; i < lines.length; i++) {
    j += 1
    let line = stripComment(lines[i])
    if (line.length === 0) { continue }

    if (prevLineEndedInContinuation) {
      // Check if the previous character is a semi-colon just before a matrix literal closes.
      const lastChar = prevLine.slice(-1)
      line = lastChar === ";" && "})]".indexOf(line.charAt(0)) > -1
        ? prevLine.slice(0, -1).trim() + line
        : lastChar === ";" || lastChar === ","
        ? prevLine + " " + line
        : prevLine + line
    }

    // Line continuation characters are: { ( [ , ; + -
    if (/[{([,;]$/.test(line)) {
      prevLineEndedInContinuation = true
      prevLine = line
      continue
    } else if (lines.length > i + 1 && /^\s*[+\-)\]}]/.test(lines[i + 1])) {
      prevLineEndedInContinuation = true
      prevLine = line
      continue
    }

    let isFromOneLiner = false
    const keyword = keywordRegEx.exec(line)
    if (keyword) {
      name = keyword[1];
      if (keyword[2]) { isFromOneLiner = true }
      expression = line.slice(name.length).trim()
      if (expression.length > 0 && /^``/.test(expression)) {
        [expression, i] = handleTSV(expression, lines, i)
      }
    } else if (isDraw && drawCommandRegEx.test(line)) {
      name = "svg"
      expression = line.indexOf(" ") === -1
        ? line + "(svg)"
        : line.replace(" ", "(svg, ") + ")"
      isStatement = true
    } else {
      if (testForStatement(line)) {
        // We have an "=" assignment operator.
        const posEq = line.indexOf("=")
        name = line.slice(0, posEq - 1).trim()
        expression = line.slice(posEq + 1).trim()
        if (/^``/.test(expression)) { [expression, i] = handleTSV(expression, lines, i) }
        if (startSvgRegEx.test(expression)) { isDraw = true }
        isStatement = true
      } else {
        // TODO: We shouldn't get here. Write an error.
        return [errorOprnd("FUNC_LINE", functionName + ", line " + (j + 1) + "\n" + line), i]
      }
    }
    if (isFromOneLiner) { j -= 1 }
    let rpn = ""
    let _
    if (expression) {
      [, rpn, _] = parse(expression, formats, true)
      if (name === "for") {
        rpn = rpn.replace(/\u00a0in\u00a0/, "\u00a0").replace(/\u00a0in$/, "")
      }
    }
    const stype = isStatement ? "statement" : name
    if (isStatement && /[,;]/.test(name)) {
      name = name.split(/[,;]/).map(e => e.trim())
    }
    funcObj.statements.push({ name, rpn, stype })
    if (stype === "if" || stype === "while" || stype === "for") {
      stackOfCtrls.push({ type: stype, statementNum: funcObj.statements.length - 1 })
    } else if (stype === "end") {
      if (stackOfCtrls.length === 0) {
        // Finished the current function.
        if (isDraw) {
          funcObj.statements.splice(-1, 0, { name: "return", rpn: "¿svg", stype: "return" })
        }
        return [funcObj, i]
      }
      const ctrl = stackOfCtrls[stackOfCtrls.length - 1]
      funcObj.statements[ctrl.statementNum].endOfBlock = funcObj.statements.length - 1
      stackOfCtrls.pop()
    }

    // Reset for next statement
    isStatement = false
    prevLineEndedInContinuation = false
    prevLine = ""
    name = ""
    expression = ""
  }
  return [errorOprnd("END_MISS", functionName), 0]
}

const scanAssignment = (lines, formats, iStart) => {
  let prevLineEndedInContinuation = false
  let str = ""
  let iEnd = iStart
  for (let i = iStart; i < lines.length; i++) {
    const line = stripComment(lines[i])
    if (line.length === 0) { continue }

    if (prevLineEndedInContinuation) {
      // Check if the previous character is a semi-colon just before a matrix literal closes.
      str = str.slice(-1) === ";" && "})]".indexOf(line.charAt(0)) > -1
        ? str.slice(0, -1).trim() + line
        : str + line
    } else {
      str = line
    }

    // Line continuation characters are: { ( [ , ; + -
    if (/[{([,;]$/.test(str)) {
      prevLineEndedInContinuation = true
    } else if (lines.length > i + 1 && /^\s*[+\-)\]}]/.test(lines[i + 1])) {
      prevLineEndedInContinuation = true
    } else {
      iEnd = i
      break
    }
  }

  const posEquals = str.indexOf("=")
  let name = str.slice(0, posEquals).trim()
  if (/[,;]/.test(name)) {
    name = name.split(/[,;]/).map(e => e.trim())
  }
  let trailStr = str.slice(posEquals + 1).trim()
  if (trailStr.length > 3 && trailStr.slice(0, 3) === '"""') {
    // We're at a macro, which extends beyond normal line endings.
    let j = iEnd
    let pos = trailStr.indexOf('"""', 3)
    while (pos < 0 && j < lines.length - 1) {
      j += 1
      trailStr += "\n" + lines[j];
      pos = trailStr.indexOf('"""', 3)
    }
    iEnd = j
  }
  const [value, unit, dtype, resultDisplay] = valueFromLiteral(trailStr, name, formats)
  const stmt = { name, value, unit, dtype, resultDisplay }
  return [stmt, iEnd]
}
