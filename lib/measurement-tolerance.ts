export type MeasurementResult = "PASS" | "WARNING" | "FAIL";

/**
 * Computes PASS / WARNING / FAIL from reference value, tolerance, and the
 * measured value. This is always computed server-side — the result field is
 * never accepted as input (Rule 7: "Tolerance calculations must be
 * automatic").
 *
 * toleranceLower/toleranceUpper are the allowed deviation in each direction
 * (e.g. reference 450, toleranceLower 2, toleranceUpper 2 means the
 * acceptable range is 448–452), matching the Section 17 example
 * (±2mm, 453mm measured -> OUT OF TOLERANCE; 451mm -> WITHIN TOLERANCE).
 *
 * FLAGGED ASSUMPTION: the brief's Section 17 examples only show a binary
 * PASS/FAIL outcome ("WITHIN TOLERANCE" / "OUT OF TOLERANCE"), but the
 * schema and Section 18 both call for a WARNING state too. Since no exact
 * WARNING threshold is specified, this implementation treats WARNING as
 * "outside tolerance but within an extra 50% buffer beyond it" — tell me if
 * there's an existing QC convention (e.g. a fixed absolute buffer, or a
 * different percentage) and this one function is where it changes.
 */
export function computeMeasurementResult(
  referenceValue: number,
  toleranceLower: number,
  toleranceUpper: number,
  measuredValue: number
): MeasurementResult {
  const allowedLower = referenceValue - Math.abs(toleranceLower);
  const allowedUpper = referenceValue + Math.abs(toleranceUpper);

  if (measuredValue >= allowedLower && measuredValue <= allowedUpper) {
    return "PASS";
  }

  const warningLower = referenceValue - Math.abs(toleranceLower) * 1.5;
  const warningUpper = referenceValue + Math.abs(toleranceUpper) * 1.5;

  if (measuredValue >= warningLower && measuredValue <= warningUpper) {
    return "WARNING";
  }

  return "FAIL";
}
