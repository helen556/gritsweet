import { notFound } from "next/navigation";

/** Невідомі адреси в межах мови → локалізована сторінка 404. */
export default function CatchAll() { notFound(); }
