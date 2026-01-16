# Bill Generation Screen Update Progress

## ✅ Completed So Far:

### 1. Added Imports
- ✅ `getCustomerOutstanding` - fetch customer outstanding balance
- ✅ `getUnpaidBills` - get unpaid bills for payment allocation
- ✅ `createPayment` - record payment
- ✅ `autoAllocatePayment` - auto-allocate payment to bills
- ✅ `BillOtherCharge` type

### 2. Added State Variables
- ✅ `otherCharges` - array of other charges (packing, ice, etc.)
- ✅ `customerOutstanding` - customer's pending balance
- ✅ `showPaymentModal` - payment dialog visibility
- ✅ `paymentAmount`, `paymentMethod`, `paymentReference`, `paymentNotes` - payment form fields
- ✅ `createdBillId` - stores bill ID when recording payment

### 3. Updated Functions
- ✅ `handleCustomerSelect` - now fetches and displays customer outstanding
- ✅ `calculateTotals` - now includes other charges in calculation
- ✅ `handleGenerateBill` - accepts `recordPayment` parameter, passes `otherCharges` to API
- ✅ `resetForm` - resets all form fields including other charges

## 🚧 Still Need to Add:

### 1. Other Charges Management Functions
Need to add these functions:

```typescript
const handleAddOtherCharge = () => {
  // Add new charge to otherCharges array
};

const handleRemoveOtherCharge = (index: number) => {
  // Remove charge from array
};
```

### 2. Payment Recording Function
```typescript
const handleRecordPayment = async () => {
  // Record payment and allocate to bills
  // Close modal, reset form, reload data
};
```

### 3. UI Components to Add

#### A. Customer Outstanding Display (after customer selection)
Show:
- Total outstanding amount
- Number of unpaid bills
- Oldest bill age

#### B. Other Charges Section (after bill items)
- Charge type dropdown (Packing, Ice, Transport, Loading, Unloading, Other)
- Description input
- Amount input (can be negative)
- Add button
- List of added charges with remove button

#### C. Updated Totals Display
Show:
- Items Total
- Other Charges Total
- Subtotal
- Adjustments
- Grand Total

#### D. Action Buttons (replace single "Generate Bill" button)
- "Save as Unpaid" button (calls `handleGenerateBill(false)`)
- "Record Payment" button (calls `handleGenerateBill(true)`)

#### E. Payment Modal
- Payment amount (pre-filled with bill total)
- Payment method dropdown
- Reference number
- Notes
- Allocation preview (shows which bills will be paid)
- Submit button

### 4. Update Bill List to Show Status
Each bill card should show:
- Status badge (Unpaid/Partial/Paid)
- Balance due amount

---

## Next Steps

I can continue implementing by adding:
1. The helper functions (other charges, payment recording)
2. The UI components listed above
3. The payment modal

Would you like me to continue with the implementation?

The file is getting large, so I may need to show you the changes in chunks or create helper components.
