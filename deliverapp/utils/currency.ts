// utils/currency.ts

export const formatCurrency = (amount: number, currency: string = 'AFG'): string => {
  // Format the amount with 2 decimal places
  const formattedAmount = amount.toFixed(2);
  
  // Return in the format "CURRENCY AMOUNT"
  return `${currency} ${formattedAmount}`;
};