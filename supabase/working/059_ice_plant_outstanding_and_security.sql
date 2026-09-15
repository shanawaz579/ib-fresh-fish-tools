-- Make finance reads obey RLS and expose unpaid sales for later collection.

ALTER FUNCTION working.get_ice_money_activity(DATE) SECURITY INVOKER;
ALTER FUNCTION working.get_ice_finance_summary(DATE, DATE) SECURITY INVOKER;

CREATE OR REPLACE FUNCTION working.get_ice_outstanding_sales()
RETURNS TABLE(entry_type TEXT,id BIGINT,title TEXT,detail TEXT,amount NUMERIC,amount_paid NUMERIC,balance NUMERIC,payment_method TEXT,created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER SET search_path = working, pg_temp AS $$
  SELECT 'sale',sale.id,COALESCE(sale.customer_name,'Walk-in'),
    to_char(sale.sale_date,'DD Mon YYYY')||' · '||sale.block_quantity||' blocks',sale.total_amount,
    COALESCE(sum(payment.amount) FILTER(WHERE payment.voided_at IS NULL),0),
    sale.total_amount-COALESCE(sum(payment.amount) FILTER(WHERE payment.voided_at IS NULL),0),NULL::TEXT,sale.created_at
  FROM working.ice_sales sale LEFT JOIN working.ice_sale_payments payment ON payment.sale_id=sale.id
  WHERE sale.voided_at IS NULL GROUP BY sale.id
  HAVING sale.total_amount-COALESCE(sum(payment.amount) FILTER(WHERE payment.voided_at IS NULL),0) > 0
  ORDER BY sale.sale_date,id;
$$;
REVOKE ALL ON FUNCTION working.get_ice_outstanding_sales() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_ice_outstanding_sales() TO authenticated;
