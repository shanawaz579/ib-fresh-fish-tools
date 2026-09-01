import { Alert, Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Bill } from '../../types';
import { buildCustomerBillPrintHtml } from './customerBillPrintHtml';
import { buildCustomerBillShareText } from './customerBillShareText';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

export function useCustomerBillDocuments(previewBill: Bill | null, customerName?: string) {
  const { configuration } = useBusinessConfig();
  const handleShareBill = async () => {
    if (!previewBill) return;

    const billText = buildCustomerBillShareText(previewBill, configuration, customerName);

    try {
      await Share.share({
        message: billText,
        title: `Bill ${previewBill.bill_number}`,
      });
    } catch (err) {
      console.error('Error sharing bill:', err);
    }
  };

  const handlePrintBill = async () => {
    if (!previewBill) return;

    const htmlContent = buildCustomerBillPrintHtml(previewBill, configuration, customerName);

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // On mobile, share the PDF
      if (Platform.OS !== 'web') {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Bill ${previewBill.bill_number}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else {
        // On web, just print
        await Print.printAsync({ html: htmlContent });
      }
    } catch (err) {
      console.error('Error printing bill:', err);
      Alert.alert('Error', 'Failed to print/share bill');
    }
  };

  return { handlePrintBill, handleShareBill };
}
