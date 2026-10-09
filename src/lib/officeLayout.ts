/** Physical measurements of the PDF resume template, in millimetres. */
export const OFFICE_A4 = {
  margin: 11,
  contentWidth: 188,
  titleHeight: 18,
  sectionGap: 4,
  profileHeight: 40,
  profileMainWidth: 154,
  photoWidth: 30,
  contactRowHeight: 9.25,
  historyHeadingHeight: 8,
  historyHeaderHeight: 7,
  historyRowHeight: 7,
  qualificationRowHeight: 6.4,
  textHeadingHeight: 8,
  motivationHeight: 54,
  selfPrHeight: 54,
  requestsHeight: 16,
  miniHeight: 26,
  borderColor: '777777',
  labelFill: 'E8E8E8',
} as const;

export const mmToTwip = (millimetres: number) => Math.round(millimetres * 1440 / 25.4);
export const mmToPoints = (millimetres: number) => millimetres * 72 / 25.4;
