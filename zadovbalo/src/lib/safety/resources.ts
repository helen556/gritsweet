/** Контакти для кризового екрана. Перевіряти актуальність перед релізом. */
export interface HelpContact {
  label: string;
  note: string;
  phone: string;
  /** Для tel: */
  dial: string;
}

export const UA_HELP_CONTACTS: readonly HelpContact[] = [
  { label: "Екстрена допомога", note: "Якщо є небезпека прямо зараз", phone: "112", dial: "112" },
  { label: "Lifeline Ukraine", note: "Кризова лінія, цілодобово, безкоштовно", phone: "7333", dial: "7333" },
  { label: "Ла Страда", note: "Психологічна підтримка, безкоштовно", phone: "116 123", dial: "116123" },
];
