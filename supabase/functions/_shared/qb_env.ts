const QBO_PRODUCTION_BASE = 'https://quickbooks.api.intuit.com';
const QBO_SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com';

export const getQboApiBase = () => {
  const rawEnvironment = Deno.env.get('QUICKBOOKS_ENVIRONMENT');
  if (rawEnvironment === null) {
    return QBO_PRODUCTION_BASE;
  }

  const environment = rawEnvironment.trim().toLowerCase();

  if (environment === 'production') {
    return QBO_PRODUCTION_BASE;
  }

  if (environment === 'sandbox') {
    return QBO_SANDBOX_BASE;
  }

  throw new Error(
    `Invalid QUICKBOOKS_ENVIRONMENT value "${rawEnvironment}". Expected "production" or "sandbox".`,
  );
};
