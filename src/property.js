import { dt, allZeros } from "./constants"
import { map } from "./map"
import { DataFrame } from "./dataframe"
import { fromAssignment } from "./operand.js"
import { errorOprnd } from "./error"
import { Rnl } from "./rational"

const endRegEx = /_end$/
const alphaRegEx = /^[A-Z]$/
const cellParts = /^([^\d]+)(\d+)?$/
const intRegEx = /^\d+$/

export function propertyFromDotAccessor(parent, index, unitAware) {
  const property = Object.create(null)
  if (parent.dtype & dt.MAP) {
    return map.range(parent, [index], unitAware)

  } else if (parent.dtype & dt.DATAFRAME) {
    return DataFrame.range(parent, [index], unitAware)

  } else if (parent.dtype === dt.SPREADSHEET) {
    let key = index.value
    if (endRegEx.test(key)) {
      // Return the cell at the bottom of a column
      key = key.slice(0, -4)
      if (!alphaRegEx.test(key)) { key = parent.columnMap[key] }
      key = key + Object.keys(parent.rowMap).length
      return fromAssignment(parent.value[key], unitAware)
    }
    if (key in parent.columnMap || alphaRegEx.test(key)) {
      // Return data from one column, in a column vector
      const colIndex = alphaRegEx.test(key) ? key : parent.columnMap[key];
      const v = [];
      let unit = null
      let dtype = null
      if (parent.value[colIndex + "1"].dtype & dt.RATIONAL) {
        for (let i = 1; i < parent.numRows; i++) {
          const cell = parent.value[colIndex + i];
          if (!(cell.dtype & dt.RATIONAL)) {
            return errorOprnd("NANEL", cell.name)
          }
          if (unitAware) {
            v.push(cell.value.inBaseUnits)
          } else {
            v.push(cell.value.plain)
          }
        }
        unit = unitAware
          ? parent.units[parent.unitMap[colIndex.codePointAt(0) - 65]]
          : allZeros
        dtype = dt.RATIONAL + dt.COLUMNVECTOR
      } else {
        for (let i = 1; i < parent.numRows; i++) {
          v.push(parent.value[colIndex + i].value)
        }
        dtype = parent.value[colIndex + "1"].dtype + dt.COLUMNVECTOR
      }
      return { value: v, unit, dtype }
    } else {
      const parts = key.match(cellParts)
      const colIndex = parts[1];
      if (parts[2]) {
        return fromAssignment(parent.value[colIndex + parts[2]], unitAware)
      } else {
        return errorOprnd("BAD_SHT_KEY", key)
      }
    }

  } else if ((parent.dtype === dt.STRING || (parent.dtype & dt.ARRAY)) &&
    index.dtype === dt.RATIONAL) {
    const indexVal = Rnl.toNumber(index.value)
    property.value = parent.value.slice(indexVal - 1, indexVal)
    property.unit = parent.unit
    property.dtype = parent.dtype
    return property

  } else if ((parent.dtype === dt.STRING || (parent.dtype & dt.ARRAY)) &&
        index.dtype === dt.RANGE) {
    const start = index.value[0] - 1
    const step = index.value[1]
    const end = (index.value[2] === "∞") ? parent.value.length : index.value[2]
    property.unit = parent.unit
    property.dtype = parent.dtype
    if (step === 1) {
      property.value = parent.value.slice(start, end)
    } else {
      property.value = []
      for (let j = start; j < end; j += step) {
        property.value.push(parent.value[j])
      }
    }
    return property

  } else if (parent.dtype === dt.MODULE) {
    // parent is a module and index has a value assigned to it.
    return fromAssignment(parent.value[index.value], unitAware)

  } else {
    return errorOprnd("NO_PROP", parent.name)
  }
}

export const cellOprnd = (sheet, args, unitAware) => {
  if (args.length === 1) {
    let key = args[0].value
    if (endRegEx.test(key)) {
      key = key.slice(0, 1) + Object.keys(sheet.rowMap).length
    }
    return fromAssignment(parent.value[key], unitAware)
  }
  let cellName = ""
  const key0 = args[0].value
  const key1 = args[1].value
  if (sheet.columnMap[key0] || alphaRegEx.test(key0)) {
    cellName = sheet.columnMap[key0] ? sheet.columnMap[key0] : key0
    if (sheet.rowMap[key1]) {
      cellName += sheet.rowMap[key1];
    } else if (intRegEx.test(key1)) {
      cellName += key1
    } else {
      // ERROR Message
    }
  } else if (sheet.columnMap[key1]  || alphaRegEx.test(key0)) {
    cellName = sheet.columnMap[key1] ? sheet.columnMap[key1] : key1
    if (sheet.rowMap[key0]) {
      cellName += sheet.rowMap[key0];
    } else if (intRegEx.test(key0)) {
      cellName += key0
    } else {
      // ERROR Message
    }
  } else {
    // ERROR
  }
  return fromAssignment(sheet.value[cellName], unitAware)
}
