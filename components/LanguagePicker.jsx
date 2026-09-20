import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useState } from 'react';

import TouchableOpacity from './FeedbackTouchableOpacity';
import { useLanguage } from '../app/context/LanguageContext';
import { useTheme } from '../app/context/ThemeContext';

export default function LanguagePicker({ visible, onClose, title = 'Choose language', subtitle = 'Select how Comm-Connect should appear.' }) {
  const { colors } = useTheme();
  const { language, languages, setLanguage, t } = useLanguage();
  const [savingLanguage, setSavingLanguage] = useState(null);

  const handleSelect = async (nextLanguage) => {
    setSavingLanguage(nextLanguage);

    try {
      await setLanguage(nextLanguage);
      onClose?.(nextLanguage);
    } finally {
      setSavingLanguage(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center', padding: 18 }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="language" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{t(title)}</Text>
              <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{t(subtitle)}</Text>
            </View>
          </View>

          {languages.map((item) => {
            const selected = item.code === language;
            const saving = savingLanguage === item.code;

            return (
              <TouchableOpacity
                key={item.code}
                onPress={() => handleSelect(item.code)}
                disabled={Boolean(savingLanguage)}
                style={{
                  minHeight: 56,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surfaceLight || colors.background,
                  paddingHorizontal: 14,
                  marginBottom: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{item.localLabel}</Text>
                  <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 2 }}>{item.label}</Text>
                </View>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? colors.primary : colors.textLight} />
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={onClose}
            disabled={Boolean(savingLanguage)}
            style={{ marginTop: 4, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.primary }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{t('Continue')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
