export function isValidObjectId(value) {
  return (
    typeof value === 'string' &&
    /^[a-fA-F0-9]{24}$/.test(value)
  )
}