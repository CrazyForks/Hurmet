import { dt, allZeros } from "./constants"
import { Rnl } from "./rational"
import { mapMap, clone, addTextEscapes } from "./utils"
import { format } from "./format"

/*
 * This file deals with Hurmet maps, which are similar to hash maps.
 * In a map, every value is of the same data type and has the same unit-of-measure.
 *
 */

const convertFromBaseUnits = (map, gauge, factor) => {
  map = mapMap( map, value =>  Rnl.divide(value, factor))
  if (!Rnl.isZero(gauge)) {
    map = mapMap( map, value => Rnl.subtract(value, gauge))
  }
  return  map
}

const convertToBaseUnits = (map, gauge, factor) => {
  if (!Rnl.isZero(gauge)) {
    map = mapMap(map, value => Rnl.add(value, gauge))
  }
  return mapMap(map, value => Rnl.multiply(value, factor))
}

const display = (map, formatSpec, decimalFormat) => {
  let str = "\\{"
  for (const [key, value] of map.entries()) {
    str += "\\text{" + addTextEscapes(key) + "}: "
    str += format(value, formatSpec, decimalFormat) + ",\\:"
  }
  return str.slice(0, -3) + "\\}"
}

const displayAlt = (map, formatSpec, decimalFormat) => {
  let str = "{"
  for (const [key, value] of map.entries()) {
    str += '"' + key + '": '
    str += format(value, formatSpec, decimalFormat) + ", "
  }
  return str.slice(0, -2) + "}"
}

const valueFromMap = (map, keys, unitAware) => {
  // Return the value of a map's key/value pair.
  // `keys` is an array. It contains > 1 key if the author wants multiple assignment
  // as in A, B = map[a, b]
  const isNumeric = (map.dtype & dt.RATIONAL)
  const treatAsUnitAware = (unitAware && (map.dtype & dt.QUANTITY) > 0)
  if (keys.length === 1) {
    const key = keys[0]
    const value = clone(map.value.get(key))
    if (!isNumeric) {
      return { value, unit: undefined, dtype: map.dtype - dt.MAP }

    } else if (treatAsUnitAware) {
      const dtype = map.dtype - dt.MAP - dt.QUANTITY
      return { value, unit: { expos: map.unit.expos }, dtype: dtype }

    } else {
      return { value, unit: allZeros, dtype: map.dtype - dt.MAP - (map.dtype & dt.QUANTITY) }
    }

  } else {
    const value = new Map()
    for (let i = 0; i < keys.length; i++) {
      value.set(keys[i], clone(map.value.get(keys[i])))
    }
    return { value, unit: clone(map.unit), dtype: map.dtype }
  }
}

export const map = Object.freeze({
  convertFromBaseUnits,
  convertToBaseUnits,
  display,
  displayAlt,
  valueFromMap
})
