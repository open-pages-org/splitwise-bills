export interface Expense {
  cost: number;
  description: string;
  details: string;
  date: string;
  repeat_interval: "never";
  currency_code: "GBP" | "USD" | "EUR";
  category_id: number;
  group_id: number;
  split_equally: boolean;
}

export const createExpense = async (apiKey: string, expense: Expense) => {
  const response = await fetch("https://secure.splitwise.com/api/v3.0/create_expense", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(expense),
  });

  return response.json();
}
