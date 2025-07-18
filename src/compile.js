﻿import { parse, checkForNumericSubscript } from "./parser"
import { dt, allZeros } from "./constants"
import { isValidIdentifier } from "./utils"
import { valueFromLiteral } from "./literal"
import { functionRegEx, drawRegEx, moduleRegEx, scanModule } from "./module"
import { unitFromUnitName } from "./units"

/*  compile.js
 *
 *  This module is called when: (1) an author submits a Hurmet calculation dialog box, or
 *  (2) when a new document is opened, or (3) when recalculate-all is called.
 *  Here we do some preparation in a calculation cell prior to calculation.
 *
 *  This module does NOT calculate the result of an expression. It stops just short of that.
 *  How do we choose where to draw the line between tasks done here and tasks done later?
 *  We do as much here as we can without knowing the values that other cells have assigned
 *  to variables. The goal is to minimize the amount of work done by each dependent cell
 *  when an author changes an assigned value.  Later, calculation updates will not have to
 *  repeat the work done in this module, so updates will be faster.
 *
 *  Variable inputStr contains the string that an author wrote into mathPrompt().
 *
 *  From that entry this module will:
 *    1. Determine the name of the cell, as in "x" from "x = 12"
 *    2. Parse the entry string into TeX, to be passed later to Temml for rendering.
 *    3. If the input asks for a calculation:
 *       a. Parse the expression into an echo string (in TeX) with placeholders that will be
 *          filled in later with values when the calculation is done.
 *       b. Compile the expression into RPN (postfix) to be passed later to evaluateRPN().
 *       c. Process the unit of measure, if any, of the result. Save it for later calculation.
 *    4. If an assigned value is static, not dynamically calculated, find its value.
 *    5. Append all the display strings together.
 *    6. Return the result. Hurmet will attach it to ProseMirror "attrs" of that node.
 */

const containsOperator = /[+\-×·*∘⌧/^%‰&√!¡|‖&=<>≟≠≤≥∈∉⋐∧∨⊻¬]|\xa0(function|mod|\\atop|root|sum|abs|cos|sin|tan|acos|asin|atan|sec|csc|cot|asec|acsc|acot|exp|log|ln|log10|log2|cosh|sinh|tanh|sech|csch|coth|acosh|asinh|atanh|asech|acsch|acoth|gamma|Γ|lgamma|logΓ|lfact|cosd|sind|tand|acosd|asind|atand|secd|cscd|cotd|asecd|acscd|acotd|real|imag|angle|Char|round|sqrt|sign|\?{}|%|⎾⏋|⎿⏌|\[\]|\(\))\xa0/
const mustDoCalculation = /^(``.+``|[$$£¥\u20A0-\u20CF]?(\?{1,2}|@{1,2}|%{1,2}|!{1,2})[^=!(?@%!{})]*)$/
const assignDataFrameRegEx = /^[^=]+=\s*``[\s\S]+``\s*$/
const currencyRegEx = /^[$£¥\u20A0-\u20CF]/
// eslint-disable-next-line max-len
const matrixOfNames = new RegExp("^[([]" + isValidIdentifier.source.slice(1, -1) + "[,;].+[)\\]]$")
const isKeyWord = /^(π|pi|ℏ|true|false|root|if|in|else|elseif|and|or|otherwise|mod|modulo|for|while|end|break|return|throw)$/
const testRegEx = /^(@{1,2})test /

const shortcut = (str, formats) => {
  // No calculation in str. Parse it just for presentation.
  const tex = parse(str, formats)
  return { entry: str, tex, alt: str }
}

export const compile = (
  inputStr,
  formats = { decimalFormat: "1,000,000.", dateFormat: "yyyy-mm-dd" }
) => {
  let leadStr = ""
  let mainStr = ""
  let trailStr = ""
  let isCalc = false
  let suppressResultDisplay = false
  let displayResultOnly = false
  let omitEcho = false
  let mustAlign = false
  let posOfFirstEquals = 0
  let expression = ""
  let echo = ""
  let rpn = ""
  let dependencies = [];
  let resultDisplay = ""
  let name = ""
  let leadsWithCurrency = false
  let value
  let unit
  let dtype
  let str = ""

  const isModule = moduleRegEx.test(inputStr)
  const isDraw = drawRegEx.test(inputStr)
  if (functionRegEx.test(inputStr) || isDraw || isModule) {
    // This cell contains a custom function.
    let name = ""
    if (isDraw) {
      name = "draw"
    } else if (isModule) {
      name = checkForNumericSubscript(moduleRegEx.exec(inputStr)[1].trim())
    } else if (!isModule) {
      const posFn = inputStr.indexOf("function")
      const posParen = inputStr.indexOf("(")
      name = checkForNumericSubscript(inputStr.slice(posFn + 8, posParen).trim())
    }
    const module = scanModule(inputStr, formats)
    const isError = module.dtype && module.dtype === dt.ERROR
    if (isError) {
      // eslint-disable-next-line no-alert
      window.alert(module.value)
    }
    const attrs = {
      entry: inputStr,
      name,
      value: (isError || isModule) ? module.value : module.value[name],
      // TODO: what to do with comma decimals?
      resultdisplay: "\\text{" + name + "}",
      dtype: isError ? dt.ERROR : name === "draw" ? dt.DRAWING : dt.MODULE,
      error: isError
    }
    return attrs
  }

  str = inputStr

  if (testRegEx.test(inputStr)) {
    str = str.replace(testRegEx, "").trim()
    const [_, rpn, dependencies] = parse(str, formats, true)
    const resulttemplate = testRegEx.exec(inputStr)[1];
    return { entry: inputStr, template: "", rpn, dependencies, resulttemplate,
      altresulttemplate: resulttemplate, resultdisplay: "" }
  }

  const isDataFrameAssigment = assignDataFrameRegEx.test(str)
  const posOfLastEquals = isDataFrameAssigment
    ? str.indexOf("=") + 1
    : str.lastIndexOf("=") + 1

  if (posOfLastEquals > 1) {
    // input has form:  mainStr = trailStr
    mainStr = str.substring(0, posOfLastEquals - 1).replace(/ +$/, "")
    if (mainStr.length > 0 && /;\s*$/.test(mainStr)) {
      mustAlign = true
      mainStr = mainStr.replace(/;\s*$/, "")
    }
    mainStr = mainStr.trim()
    trailStr = str.substring(posOfLastEquals).trim()

    if (mustDoCalculation.test(trailStr)) {
      // trailStr contains a ? or a @ or a % or a !. In other words,
      // input has form:  mainStr = something [?@%!] something
      // The [?@%!] signals that the author wants a calculation done.
      isCalc = true

      // A ! tells us to calculate and save the result, but to NOT display the result.
      suppressResultDisplay = trailStr.indexOf("!") > -1

      // A @ tells us to display only the result.
      displayResultOnly = trailStr.indexOf("@") > -1

      omitEcho = trailStr.indexOf("%") > -1

      posOfFirstEquals = mainStr.indexOf("=") + 1
      if (posOfFirstEquals) {
        // input has form:  leadStr = something = trailStr
        leadStr = mainStr.slice(0, posOfFirstEquals - 1).trim()

        // Input has form:  name = expression = trailStr, or
        //                  name1, name2, = expression = trailStr
        expression = mainStr.substring(posOfFirstEquals).trim()
        if (matrixOfNames.test(leadStr)) { leadStr = leadStr.slice(1, -1).trim() }
        if (/[,;]/.test(leadStr)) {
          const potentialIdentifiers = leadStr.split(/[,;]/)
          for (let i = 0; i < potentialIdentifiers.length; i++) {
            const candidate = potentialIdentifiers[i].trim()
            if (isKeyWord.test(candidate) || !isValidIdentifier.test(candidate)) {
              // leadStr is not a list of valid identifiers.
              // So this isn't a valid calculation statement. Let's finish early.
              return shortcut(str, formats)
            }
          }
          // multiple assignment.
          name = potentialIdentifiers.map(e => checkForNumericSubscript(e.trim()))

        } else {
          if (isValidIdentifier.test(leadStr) && !isKeyWord.test(leadStr)) {
            name = checkForNumericSubscript(leadStr)
          } else {
            // The "=" sign is inside an expression. There is no lead identifier.
            // This statement does not assign a value to a variable. But it may do a calc.
            // input has form:  expression = trailStr
            expression = mainStr
          }
        }
      } else {
        // This calculation string contains only one "=" character.
        // input has form:  expression = trailStr
        expression = mainStr
      }
    } else if (isDataFrameAssigment) {
      name = checkForNumericSubscript(mainStr)
      expression = trailStr
    } else  if (isValidIdentifier.test(mainStr) && !isKeyWord.test(mainStr)) {
      // No calculation display selector is present,
      // but there is one "=" and a valid idendtifier.
      // It may be an assignment statement.
      // input has form:  name = trailStr
      name = checkForNumericSubscript(mainStr)
      if (trailStr === "") {
        const tex = parse(str, formats)
        return { entry: str, tex, alt: str }
      }
    } else {
      // input has form:  mainStr = trailStr.
      // It almost works as an assignment statment, but mainStr is not a valid identifier.
      // So we'll finish early.
      return shortcut(str, formats)
    }
  } else {
    // str contains no "=" character. Let's fnish early.
    return shortcut(str, formats)
  }

  if (expression.length > 0) {
    // The author may want a calculation done on the expression.
    if (/^\s*fetch\(/.test(expression)) {
      // fetch() functions are handled in updateCalculations.js, not here.
      // It's easier from there to send a fetch() callback to a ProseMirror transaction.
      echo = ""

    } else {
      // Parse the expression. Stop short of doing the calculation.
      [echo, rpn, dependencies] = parse(expression, formats, true)

      // Shoulld we display an echo of the expression, with values shown for each variable?
      if (suppressResultDisplay || displayResultOnly || echo.indexOf("〖") === -1
          || /\u00a0for\u00a0/.test(rpn)) {
        // No.
        echo = ""
      } else if (omitEcho) {
        echo = ""
      } else {
        // The expression calls a variable.
        // If it also contains an operator or a function, then we need to show the echo.
        if (containsOperator.test("\xa0" + rpn + "\xa0")) {
          echo = "\\textcolor{#0000ff}{" + echo + "}"
        } else {
          echo = ""
        }
      }
    }
  }

  // Now let's turn our attention from the expression to the trailStr.
  if (currencyRegEx.test(trailStr)) {
    leadsWithCurrency = true
    unit = trailStr.charAt(0)
  }

  if (isCalc) {
    // trailStr contains a display selector.
    value = null

    if (!leadsWithCurrency) {
      // Check for a unit, even if it isn't a unit-aware calculation
      unit = trailStr.replace(/[?@%!']/g, "").trim()
    }

    if (suppressResultDisplay) {
      resultDisplay = trailStr
    } else {
      if (unit) {
        resultDisplay = trailStr.trim().replace(/([^ ?!@%]+)$/, "'" + "$1" + "'")
        resultDisplay = parse(resultDisplay, formats).replace(/\\%/g, "%").replace("@ @", "@@")
      } else {
        resultDisplay = parse(trailStr, formats).replace(/\\%/g, "%").replace("@ @", "@@")
      }
      resultDisplay = resultDisplay.replace(/\\text\{(\?\??|%%?)\}/, "$1")
      resultDisplay = resultDisplay.replace(/([?%]) ([?%])/, "$1" + "$2")
    }

  } else {
    // trailStr may be a static value in an assignment statement.
    let isPlaceholder = false
    if (trailStr.slice(-1) === "_") {
      isPlaceholder = true
      trailStr = trailStr.slice(0, -1).trim()
    }
    // Check if trailStr is a valid literal.
    ;[value, unit, dtype, resultDisplay] = valueFromLiteral(trailStr, name, formats)
    if (isPlaceholder) {
      resultDisplay = "\\colorbox{aqua}{" + resultDisplay + "}"
    }

    if (dtype === dt.ERROR) { return shortcut(str, formats) }
    rpn = ""
  }

  // Assemble the equation to display
  let eqn = ""
  let altEqn = ""
  if (!displayResultOnly) {
    eqn = parse(mainStr, formats)
    if (mustAlign) {
      eqn = "\\begin{aligned}" + eqn
      const pos = eqn.indexOf("=")
      if (pos !== -1) {
        eqn = eqn.slice(0, pos) + "&" + eqn.slice(pos)
      }
    }
    const alignChar = mustAlign ? "\\\\ &" : ""
    altEqn = mainStr
    if (echo.length > 0 && !omitEcho) {
      eqn += ` ${alignChar}= ` + echo
    }
    if (!suppressResultDisplay) {
      eqn += " " + (mustAlign ? "\\\\&" : "") + "= " + resultDisplay
      altEqn += " = " + trailStr
    }
    if (mustAlign) { eqn += "\\end{aligned}" }
  }

  // Populate the object to be returned.
  // It will eventually be attached to ProseMirror schema attrs, so call it "attrs".
  const attrs = {
    entry: str,
    template: eqn,
    altTemplate: altEqn,
    resultdisplay: resultDisplay,
    dtype: dtype,
    error: false
  }

  if (name) { attrs.name = name }
  if (isCalc) {
    attrs.resulttemplate = resultDisplay
    attrs.altresulttemplate = trailStr
  } else {
    attrs.tex = eqn
    attrs.alt = altEqn
  }
  if (rpn) { attrs.rpn = rpn }
  if (dependencies.length > 0) { attrs.dependencies = dependencies }
  if (value) { attrs.value = value }
  if (unit) {
    if (rpn && !attrs.value) {
      attrs.unit = typeof unit === "string"
        ? unitFromUnitName(unit)
        : { factor: 1, gauge: 0, expos: allZeros }
    } else {
      attrs.unit = Array.isArray(unit) ? { expos:  unit } : unit
    }
  }

  return attrs
}
