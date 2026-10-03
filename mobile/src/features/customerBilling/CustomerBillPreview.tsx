import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { Bill } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg, sortFishItems } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import styles from '../../styles/BillGenerationScreen.styles';
import { useBusinessConfig } from '../../context/BusinessConfigContext';
import { getBusinessBillBranding } from '../billing/businessBillBranding';

type CustomerBillPreviewProps = {
  visible: boolean;
  bill: Bill | null;
  customerName?: string;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
};

export default function CustomerBillPreview({
  visible,
  bill: previewBill,
  customerName,
  onClose,
  onPrint: handlePrintBill,
  onShare: handleShareBill,
}: CustomerBillPreviewProps) {
  const { configuration, formatMoney } = useBusinessConfig();
  const { profile, preferences } = configuration;
  const paymentsTotal = (previewBill?.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  const balanceAfterPayments = (previewBill?.previous_balance || 0) - paymentsTotal;
  const branding = getBusinessBillBranding(profile);
  return (
    <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => onClose()}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bill Preview</Text>
            <TouchableOpacity onPress={() => onClose()} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {previewBill && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.billPreview}>
                {/* Business Header */}
                <View style={styles.businessHeader}>
                  <View style={styles.businessHeaderMain}>
                    <Text style={styles.companyNameMain}>{branding.name}</Text>
                    <Text style={styles.documentTitle}>Sales Bill</Text>
                  </View>
                  {branding.proprietor ? <Text style={styles.proprietorText}>{branding.proprietor}</Text> : null}
                  <Text style={styles.businessTagline}>{branding.tagline}</Text>
                  {branding.contactLine ? <Text style={styles.businessDetails}>{branding.contactLine}</Text> : null}
                </View>

                <View style={styles.customerInfo}>
                  <View style={styles.customerRow}>
                    <View style={styles.customerLeft}>
                      <Text style={styles.customerNameBig}>
                        {customerName || 'Unknown'}
                      </Text>
                      <Text style={styles.totalBoxesText}>
                        Total: {(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} boxes
                      </Text>
                    </View>
                    <View style={styles.customerRight}>
                      <Text style={styles.billNumberText}>{previewBill.bill_number}</Text>
                      <Text style={styles.billDateText}>
                        {formatBusinessDate(previewBill.bill_date)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.itemsTable}>
                  {sortFishItems(previewBill.items || [], item => item.fish_variety_name).map((item, index) => {
                    const crateWeight = item.crate_weight ?? preferences.default_crate_weight_kg ?? DEFAULT_CRATE_WEIGHT_KG;
                    const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
                    const qtyText = [
                      item.quantity_crates > 0 && `${item.quantity_crates} cr`,
                      item.quantity_kg > 0 && `${item.quantity_kg} kg`
                    ].filter(Boolean).join(' · ') || '0 kg';

                    return (
                      <View key={index} style={styles.itemCard}>
                        <View style={styles.itemCardMain}>
                          <Text style={styles.itemCardName}>{item.fish_variety_name}</Text>
                          <Text style={styles.itemCardAmount}>{formatMoney(item.amount, 0)}</Text>
                        </View>
                        <View style={styles.itemCardMeta}>
                          <Text style={styles.itemCardMetaText}>{qtyText} | {totalWeight.toFixed(2)} kg</Text>
                          <Text style={styles.itemCardMetaText}>{formatMoney(item.rate_per_kg, 0)}/kg</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.billTotals}>
                  {/* Previous Balance */}
                  {previewBill.previous_balance !== 0 && (
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>{previewBill.previous_balance < 0 ? 'Customer Credit Brought Forward:' : 'Previous Balance:'}</Text>
                      <Text style={styles.billTotalValue}>{previewBill.previous_balance < 0 ? '−' : ''}{formatMoney(Math.abs(previewBill.previous_balance), 2)}</Text>
                    </View>
                  )}

                  {/* Payments Received */}
                  {previewBill.payments && previewBill.payments.length > 0 && (
                    <>
                      <Text style={styles.paymentsSectionTitle}>Less: Payments Received</Text>
                      {previewBill.payments.map((payment, index) => (
                        <View key={index} style={[styles.billTotalRow, styles.paymentRow]}>
                          <Text style={styles.paymentLabel}>
                            {formatBusinessDate(payment.payment_date)} - {payment.payment_method.toUpperCase()}
                          </Text>
                          <Text style={styles.paymentValue}>{formatMoney(payment.amount, 2)}</Text>
                        </View>
                      ))}
                      <View style={[styles.billTotalRow, styles.subtotalRow]}>
                        <Text style={styles.billTotalLabel}>
                          {balanceAfterPayments < 0 ? 'Credit after payments:' : 'Balance after payments:'}
                        </Text>
                        <Text style={[styles.billTotalValue, balanceAfterPayments < 0 ? styles.creditBalance : null]}>
                          {balanceAfterPayments < 0 ? '−' : ''}{formatMoney(Math.abs(balanceAfterPayments), 2)}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Separator */}
                  {(previewBill.previous_balance !== 0 || (previewBill.payments && previewBill.payments.length > 0)) && (
                    <View style={styles.separator} />
                  )}

                  {/* Items Total */}
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalLabel}>Items Total:</Text>
                    <Text style={styles.billTotalValue}>
                      {formatMoney((previewBill.items || []).reduce((sum, item) => sum + item.amount, 0), 2)}
                    </Text>
                  </View>

                  {/* Other Charges */}
                  {previewBill.other_charges && previewBill.other_charges.length > 0 && (
                    <>
                      {previewBill.other_charges.map((charge, index) => (
                        <View key={index} style={[styles.billTotalRow, styles.chargeRow]}>
                          <Text style={styles.chargeLabel}>
                            + {charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1)}
                            {charge.description ? ` (${charge.description})` : ''}
                          </Text>
                          <Text style={styles.chargeValue}>{formatMoney(charge.amount, 2)}</Text>
                        </View>
                      ))}
                      <View style={[styles.billTotalRow, styles.subtotalRow]}>
                        <Text style={styles.billTotalLabel}>Subtotal:</Text>
                        <Text style={styles.billTotalValue}>{formatMoney(previewBill.subtotal, 2)}</Text>
                      </View>
                    </>
                  )}

                  {/* Discount */}
                  {previewBill.discount > 0 && (
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>Less: Discount</Text>
                      <Text style={styles.billTotalValue}>{formatMoney(previewBill.discount, 2)}</Text>
                    </View>
                  )}

                  {/* Grand Total */}
                  <View style={[styles.billTotalRow, styles.grandTotal]}>
                    <Text style={styles.billGrandTotalLabel}>TOTAL DUE:</Text>
                    <Text style={styles.billGrandTotalValue}>{formatMoney(previewBill.total, 2)}</Text>
                  </View>
                </View>

                {previewBill.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesTitle}>Notes:</Text>
                    <Text style={styles.notesText}>{previewBill.notes}</Text>
                  </View>
                )}

                {/* Footer */}
                <View style={styles.billFooter}>
                  <Text style={styles.footerText}>Thank you for your business!</Text>
                </View>
              </View>

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={handlePrintBill} style={styles.printButton}>
                  <Text style={styles.printButtonText}>📄 Print/Save as PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareBill} style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>📱 Share as Text</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
    </Modal>
  );
}
