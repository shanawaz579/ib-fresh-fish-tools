import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { Bill } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import styles from '../../styles/BillGenerationScreen.styles';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

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
                  <View style={styles.headerTopRow}>
                    <Text style={styles.proprietorText}>{profile.legal_name || profile.display_name}</Text>
                    <Text style={styles.contactText}>{profile.phone ? `📞 ${profile.phone}` : ''}</Text>
                  </View>
                  <Text style={styles.companyNameMain}>{profile.display_name}</Text>
                  <Text style={styles.businessTagline}>{profile.tagline}</Text>
                  {profile.address ? <Text style={styles.addressText}>{profile.address}</Text> : null}
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
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.itemColumnWide]}>Item</Text>
                    <Text style={[styles.tableHeaderText, styles.weightColumn]}>Weight{'\n'}(kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.rateColumn]}>Rate{'\n'}({preferences.currency_symbol}/kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.amountColumn]}>Amount{'\n'}({preferences.currency_symbol})</Text>
                  </View>
                  {(previewBill.items || []).map((item, index) => {
                    const crateWeight = item.crate_weight ?? preferences.default_crate_weight_kg ?? DEFAULT_CRATE_WEIGHT_KG;
                    const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
                    const qtyText = [
                      item.quantity_crates > 0 && `${item.quantity_crates} cr`,
                      item.quantity_kg > 0 && `${item.quantity_kg} kg`
                    ].filter(Boolean).join(' · ') || '0 kg';

                    return (
                      <View key={index} style={styles.tableRow}>
                        <View style={styles.itemColumnWide}>
                          <Text style={styles.tableCellText}>{item.fish_variety_name}</Text>
                          <Text style={styles.qtySubtext}>{qtyText}</Text>
                        </View>
                        <Text style={[styles.tableCellText, styles.weightColumn]}>
                          {totalWeight.toFixed(2)}
                        </Text>
                        <Text style={[styles.tableCellText, styles.rateColumn]}>
                          {item.rate_per_kg}
                        </Text>
                        <Text style={[styles.tableCellText, styles.amountColumn]}>{item.amount.toFixed(2)}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.billTotals}>
                  {/* Previous Balance */}
                  {previewBill.previous_balance > 0 && (
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>Previous Balance:</Text>
                      <Text style={styles.billTotalValue}>{formatMoney(previewBill.previous_balance, 2)}</Text>
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
                          {previewBill.balance_due < 0 ? 'Credit Balance:' : 'Balance Outstanding:'}
                        </Text>
                        <Text style={[styles.billTotalValue, previewBill.balance_due < 0 ? styles.creditBalance : null]}>
                          {formatMoney(Math.abs(previewBill.balance_due), 2)}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Separator */}
                  {(previewBill.previous_balance > 0 || (previewBill.payments && previewBill.payments.length > 0)) && (
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
