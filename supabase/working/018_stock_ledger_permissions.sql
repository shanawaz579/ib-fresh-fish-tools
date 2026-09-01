-- Defense in depth: ledger rows are written only by source triggers and controlled RPCs.

REVOKE INSERT, UPDATE, DELETE ON working.stock_movements FROM authenticated;
