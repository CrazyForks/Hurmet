import { dt } from "./constants";
import { addTextEscapes } from "./utils"

const errorMessages = Object.freeze({
  EN: {
    ERROR:     "Error. Hurmet does not understand the expression.",
    ERR_FUNC:  "@",
    BAD_FUN_NM:"Error. Unrecognized function name \"@\".",
    DIV:       "Error. Divide by zero.",
    NAN:       "Error. Value of $@$ is not numeric.",
    NANARG:    "Error. Argument to function $@$ must be numeric.",
    // eslint-disable-next-line max-len
    NANEL:     "Error. A numeric vector must have numeric elements. The value of $@$ is not numeric.",
    NULL:      "Error. Missing value for $@$.", // $@$ will be italic in TeX
    BAD_EQ:    'Error. Use "==" instead of "=" to check for equality.',
    V_NAME:    "Error. Variable $@$ not found.",
    F_NAME:    "Error. Function @ not found.",
    NAN_OP:    "Error. Arithmetic operation on a non-numeric value.",
    UNIT_ADD:  "Error. Adding incompatible units.",
    UNIT_COMP: "Error. Comparing incompatible units.",
    UNIT_APEND:"Error. Apppending incompatible units.",
    UNIT_RES:  "Error. Calculated units are not compatible with the desired result unit:",
    UNIT_MISS: "Error. No units specified for the result.",
    UNIT_IN:   "Error. Incorrect unit for input to function @.",
    UNIT_ARG:  "Error. Unit mis-match between arguments to function @.",
    UNIT_COL:  "Error. Data frame column @ has no units. Do not make a unit-aware call to it.",
    UNIT_AWARE: "Error. Calculation must be unit-aware in order to apply unit @",
    UNIT_UN:    "Error. Hurmet does not do unit aware calculations involving @",
    DATE:      "Error. Date required.",
    LOGIC:     "Error. Logic operation “@” on a non-boolean value.",
    FACT:      "Error. Factorial may be applied only to a unit-less non-negative integer.",
    PER:       "Error. Percentage may be applied only to a unit-less number.",
    BINOM:     "Error. Binomial may be applied only to unit-less numbers.",
    LOGF:      "Error. Argument to log!() must be a non-negative integer.",
    Γ0:        "Error. Γ(0) is infinite.",
    ΓPOLE:     "Error. Γ() of a negative integer is infinite.",
    LOGΓ:      "Error. Argument to Hurmet lgamma() must be a positive number.",
    TAN90:     "Error. tan($@$) is infinite.",
    ATRIG:     "Error. Input to @ must be between -1 and 1.",
    COT:       "Error. Input to @ must not be zero.",
    ASEC:      "Error. Absolute value of input to @ must be ≥ 1",
    STRING:    "Error. Text operand required.",
    NUMARGS:   "Error. Wrong number of arguments passed to function @.",
    NONSQUARE: "Error. Only a square matrix can be inverted.",
    SINGULAR:  "Error. Matrix is singular and cannot be inverted.",
    BAD_ROW_NAME:     "Error. Data frame does not have a row named @.",
    BAD_COLUMN_NAME:  "Error. Data frame does not have a column named @.",
    BAD_COLUMN_TYPE:  "Error. A map must have only one data type and one unit.",
    SINGLE_ARG:"Error. A call to a data frame must have two arguments in the brackets.",
    BAD_TYPE:  "Error. Unrecognized data type for $@$.",
    CONCAT:    "Error. Cannot add strings. Use \"&\" if concatenation is desired.",
    MATRIX_DIV:"Error. Cannot divide one matrix by another.",
    MATRIX_MOD:"Error. Cannot take the modulo of one matrix by another.",
    BAD_INDEX: "Error. Index to a matrix must be numeric.",
    FUNC_LINE: "Error in function @",
    BAD_BREAK: "Error in function @. break called outside of a loop",
    FETCH:     "Error. A fetch() function must be the only item in its expression.",
    STR_INDEX: "Error. The index to text may be only a real number or a range.",
    UNIT_NAME: "Error. Unrecognized unit name: @",
    INT_NUM:   "Error. Number display type \"@\" must be an integer.",
    TWO_MAPS:  "Error. Both operands are maps. Hurmet accepts only one.",
    BAD_FORMAT:"Error. Invalid format @.",
    BAD_PREC:  "Error. Significant digit specification must be between 1 and 15.",
    ZERO_ROOT: "Error. Zeroth root.",
    BAD_ROOT:  "Error while taking root.",
    UNREAL:    "Error. Argument to function \"@\" must be a real number.",
    BIGINDEX:  "Error. Index too large.",
    MIS_ELNUM: "Error. Mis-matched number of elements",
    // eslint-disable-next-line max-len
    CROSS:     "Error. Cross product can be performed only on three-vectors. Use * if you want element-wise multiplication.",
    QUANT_NUM: "Error. A Quantity must include a numeric magnitude.",
    CURRENCY:  "Error. Currency exchange rates must be defined before using a monetary unit.",
    DF_UNIT:   "Invalid unit \"&\" in data frame.",
    FORM_FRAC: "Error. Hurmet can do binary or hexadecimal format only on integers.",
    PRIVATE:   "Error. Function @ is not private.",
    INT_ARG:   "Error. The @ function can take only integers as arguments.",
    BAD_KEY:   "Error. Data structure does not contain key \"@\".",
    BAD_SHT_KEY: "Error. Spreadsheet does not contain key \"@\".",
    NUM_KEY:   "Error. A key must be a string, not a number.",
    IMMUT_UDF: `Error. Variable @ already contains a user-defined function.
                Hurmet cannot assign a different value to @.`,
    NO_PROP:   `Error. Cannot call a property from variable "@" because it has no properties.`,
    NOT_ARRAY: `Error. Cannot The second operand is not an array.`,
    MULT_MIS:  "Error. Mismatch in number of multiple assignment.",
    COUNT:     "Error. The count() function works only on strings.",
    NOT_VECTOR:"Error. Arguments to @() must be vectors.",
    BAD_DISPLAY:"Error. Result may not be suppressed. Use '?' display selector.",
    NA_COMPL_OP:"Error. \"@\" cannot be performed on a complex number.",
    NA_REAL:    "Error. \"@\" can be performed only a complex number.",
    ORIGIN:     "Error. Function \"@\" is undefined at the origin.",
    LOG_ZERO:   "Error. Logarithm of zero is negative infinity.",
    END_MISS:   "Error. Too few END statments in function @.",
    BAD_CONCAT: "Error. Unmatched dimensions.",
    BAD_KEYSTR: "Error. The key in a key:value pair must be a string.",
    BAD_APPEND: "Error. Can not append a @",
    MAP_APPEND: "Error. Can not append. Wrong data type.",
    BAD_TRANS:  "Error. Only a matrix can be transposed.",
    BAD_ARGS:   "Error. Wrong number of arguments to function @",
    BAD_SUM:    "Error. Second argument to sum function must be 1 or 2.",
    ZERO_STEP:  "Error. Step value must be > zero.",
    SHEET_INDEX:"Error. Bad column or row index.",
    UNSAVED:    "Error. The current document has not been saved.",
    UNIT_IN_MAT:"Error. Matrix elements cannot contain a unit." +
                " Write the unit outside the matrix."
  }
})

export const errorOprnd = (errorCode, messageInsert) => {
  if (errorCode === "") { return { value: "Error", unit: null, dtype: dt.ERROR } }
  let msg = errorMessages["EN"][errorCode]
  if (msg === undefined) { return { value: "Error", unit: null, dtype: dt.ERROR } }
  if (messageInsert) {
    messageInsert = addTextEscapes(messageInsert)
    msg = msg.replace(/@/g, messageInsert)
  } else {
    msg = msg.replace(/@ ?/, "")
  }
  return { value: msg, unit: null, dtype: dt.ERROR }
}
