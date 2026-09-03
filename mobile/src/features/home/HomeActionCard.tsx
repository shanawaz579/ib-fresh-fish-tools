import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/HomeScreen.styles';

type Props = {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
};

export default function HomeActionCard({ icon, title, subtitle, color, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <Text style={[styles.actionIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle} numberOfLines={2}>{subtitle}</Text>
    </TouchableOpacity>
  );
}
