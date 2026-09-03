import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  listContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 32,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  toggleAllButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  toggleAllText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    marginTop: 32,
  },
  customerGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customerHeader: {
    backgroundColor: '#F3F4F6',
    padding: 12,
  },
  customerHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerHeaderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 22,
  },
  customerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  collapseIcon: {
    fontSize: 12,
    color: '#6B7280',
    width: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flexShrink: 1,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  quantityIcon: {
    fontSize: 16,
  },
  customerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  billingStatusBilled: {
    backgroundColor: '#D1FAE5',
  },
  billingStatusUnbilled: {
    backgroundColor: '#FEE2E2',
  },
  billingStatusPartial: {
    backgroundColor: '#FEF3C7',
  },
  billingStatusIcon: {
    fontSize: 12,
  },
  billingStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  generateBillButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateBillButtonText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '600',
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  saleInfo: {
    flex: 1,
  },
  varietyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  quantity: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  customerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
});
