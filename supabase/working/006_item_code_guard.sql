-- Keep business-facing item and variant codes stable after operational use.

CREATE OR REPLACE FUNCTION working.protect_catalog_item_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code
     AND EXISTS (
       SELECT 1
       FROM working.item_variants variant
       WHERE variant.item_id = OLD.id
         AND (
           EXISTS (
             SELECT 1 FROM working.purchases purchase
             WHERE purchase.fish_variety_id = variant.id
           )
           OR EXISTS (
             SELECT 1 FROM working.sales sale
             WHERE sale.fish_variety_id = variant.id
           )
           OR EXISTS (
             SELECT 1 FROM working.bill_items bill_item
             WHERE bill_item.fish_variety_id = variant.id
           )
           OR EXISTS (
             SELECT 1 FROM working.purchase_bill_items purchase_bill_item
             WHERE purchase_bill_item.fish_variety_id = variant.id
           )
         )
     ) THEN
    RAISE EXCEPTION
      'Item code cannot change after the item has transaction history';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_catalog_item_code ON working.items;
CREATE TRIGGER protect_catalog_item_code
BEFORE UPDATE OF code ON working.items
FOR EACH ROW
EXECUTE FUNCTION working.protect_catalog_item_code();

REVOKE ALL ON FUNCTION working.protect_catalog_item_code() FROM PUBLIC;
