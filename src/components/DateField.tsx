// Поле выбора даты/времени с корректным UX на обеих платформах.
// iOS: спиннер в модалке снизу с кнопками «Готово»/«Отмена» (раньше барабан
// висел на пол-экрана без подтверждения). Android: нативный диалог с OK/Отмена.

import React, { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

interface Props {
  value: Date | null;
  onChange: (d: Date) => void;
  format: (d: Date) => string;
  placeholder?: string;
  mode?: 'date' | 'time';
  maximumDate?: Date;
  minimumDate?: Date;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function DateField({
  value,
  onChange,
  format,
  placeholder = 'Выбрать',
  mode = 'date',
  maximumDate,
  minimumDate,
  minuteInterval,
  icon = 'calendar-outline',
}: Props) {
  const [show, setShow] = useState(false);
  // initial — стабильное значение для пикера (не меняем во время прокрутки,
  // иначе iOS-барабан «отскакивает» назад и невозможно выбрать нужное).
  const [initial, setInitial] = useState<Date>(value ?? new Date(2000, 0, 1));
  // Текущий выбор колеса держим в ref и фиксируем только по «Готово».
  const selectedRef = useRef<Date>(value ?? new Date(2000, 0, 1));

  const open = () => {
    const start = value ?? new Date(2000, 0, 1);
    setInitial(start);
    selectedRef.current = start;
    setShow(true);
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    setShow(false);
    if (e.type === 'set' && d) onChange(d);
  };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={open} activeOpacity={0.8}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? format(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={initial}
          mode={mode}
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          minuteInterval={minuteInterval}
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.backdrop}>
            <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={() => setShow(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setShow(false)} hitSlop={10}>
                  <Text style={styles.cancel}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onChange(selectedRef.current);
                    setShow(false);
                  }}
                  hitSlop={10}
                >
                  <Text style={styles.done}>Готово</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={initial}
                mode={mode}
                display="spinner"
                themeVariant="dark"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                minuteInterval={minuteInterval}
                onChange={(_e, d) => { if (d) selectedRef.current = d; }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.text, fontSize: 15 },
  placeholder: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { color: colors.textMuted, fontSize: 16 },
  done: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  iosPicker: { alignSelf: 'center', height: 216 },
});
