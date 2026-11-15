/** Display only. Forms, clipboard and exports must keep the original HN. */
export function displayHospitalNumber(value: string | null | undefined): string {
  if (!value) return "";
  const characters = Array.from(value);
  if (characters.length <= 2) return value;
  return `${characters.slice(2).join("")}-${characters.slice(0, 2).join("")}`;
}
