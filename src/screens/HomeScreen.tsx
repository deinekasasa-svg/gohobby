// Главный экран — свайп карточек активностей (ядро приложения).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Swiper from 'react-native-deck-swiper';
import * as Location from 'expo-location';

import Card from '../components/Card';
import CityField from '../components/CityField';
import MatchModal from '../components/MatchModal';
import { useAuth } from '../context/AuthContext';
import { addLike, createMatchChat, getActivities, isMutualMatch } from '../services/data';
import { colors, radius, spacing } from '../theme';
import type { Activity, Chat, GeoPoint } from '../types';

// Радиус «рядом со мной» в километрах: активности дальше не попадают в ленту.
const NEARBY_RADIUS_KM = 100;

function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { currentUser } = useAuth();
  const swiperRef = useRef<Swiper<Activity>>(null);
  const tabBarHeight = useBottomTabBarHeight();
  // Измеряем реальную высоту deck-контейнера через onLayout,
  // затем вычисляем marginBottom так, чтобы карточка заканчивалась
  // выше кнопок (64px) с отступом 16px над таб-баром.
  const [deckHeight, setDeckHeight] = useState(0);
  const onDeckLayout = (e: LayoutChangeEvent) => setDeckHeight(e.nativeEvent.layout.height);
  const BUTTON_AREA = tabBarHeight + 64 + 24; // таб-бар + кнопки + зазор
  const { height: winH } = useWindowDimensions();
  const swiperMarginBottom = deckHeight > 0
    ? winH - (deckHeight - BUTTON_AREA) - 24   // 24 = cardVerticalMargin * 2
    : winH * 0.38;                              // до первого layout — запасное значение


  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSwiped, setAllSwiped] = useState(false);
  const [deckKey, setDeckKey] = useState(0);

  const [matchActivity, setMatchActivity] = useState<Activity | null>(null);
  const [matchChat, setMatchChat] = useState<Chat | null>(null);

  // Фильтр: "рядом" (моё гео) или выбранный из списка город
  type FilterMode = 'nearby' | 'city';
  const [filterMode, setFilterMode] = useState<FilterMode>('nearby');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCityLocation, setSelectedCityLocation] = useState<GeoPoint | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  // Город вписан вручную (через автоподсказки) — храним и координаты.
  const handleCitySelect = (city: string, location: GeoPoint) => {
    setSelectedCity(city);
    setSelectedCityLocation(location);
    setCityPickerVisible(false);
  };

  // Быстрый выбор города, в котором уже есть активности (по названию).
  const handleQuickCity = (city: string) => {
    setSelectedCity(city);
    setSelectedCityLocation(null);
    setCityPickerVisible(false);
  };

  // Моё гео: берём сохранённое в профиле, по возможности обновляем «живым».
  const [myLocation, setMyLocation] = useState<GeoPoint | null>(currentUser?.location ?? null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return; // разрешение не выдано — оставляем сохранённое
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // молча оставляем сохранённое гео из профиля
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Уникальные города из всех активностей
  const availableCities = useMemo(() => {
    const set = new Set(activities.map((a) => a.ownerCity).filter(Boolean));
    return Array.from(set).sort();
  }, [activities]);

  // Активности после фильтрации
  const filteredActivities = useMemo(() => {
    if (filterMode === 'nearby') {
      // Есть гео → показываем то, что в радиусе, отсортированное по близости.
      if (myLocation) {
        return activities
          .filter((a) => a.ownerLocation && haversineKm(myLocation, a.ownerLocation) <= NEARBY_RADIUS_KM)
          .sort(
            (a, b) =>
              haversineKm(myLocation, a.ownerLocation!) - haversineKm(myLocation, b.ownerLocation!),
          );
      }
      // Нет гео → запасной вариант: город из профиля.
      const myCity = currentUser?.city ?? '';
      return activities.filter((a) => a.ownerCity === myCity);
    }
    // Режим «Город»: если есть координаты выбранного города — фильтруем по радиусу
    // вокруг него (учитывает разные написания), иначе точное совпадение названия.
    if (selectedCityLocation) {
      const center = selectedCityLocation;
      return activities
        .filter(
          (a) =>
            a.ownerCity === selectedCity ||
            (a.ownerLocation && haversineKm(center, a.ownerLocation) <= NEARBY_RADIUS_KM),
        )
        .sort((a, b) => {
          if (!a.ownerLocation) return 1;
          if (!b.ownerLocation) return -1;
          return haversineKm(center, a.ownerLocation) - haversineKm(center, b.ownerLocation);
        });
    }
    if (selectedCity) {
      return activities.filter((a) => a.ownerCity === selectedCity);
    }
    return activities;
  }, [activities, filterMode, selectedCity, selectedCityLocation, myLocation, currentUser?.city]);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getActivities(currentUser?.id);
    setActivities(list);
    setLoading(false);
  }, [currentUser?.id]);

  // Пересоздаём колоду при смене фильтра или данных
  useEffect(() => {
    setAllSwiped(filteredActivities.length === 0);
    setDeckKey((k) => k + 1);
  }, [filteredActivities]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadDeck = () => {
    setAllSwiped(false);
    setDeckKey((k) => k + 1);
    load();
  };

  const handleSwipedRight = (index: number) => {
    const activity = filteredActivities[index];
    if (!activity || !currentUser) return;
    addLike(currentUser.id, activity); // в «Хочу пойти»
    if (isMutualMatch()) {
      // Окно мэтча показываем мгновенно, чат создаём в фоне.
      setMatchActivity(activity);
      setMatchChat(null);
      createMatchChat(currentUser, activity)
        .then(setMatchChat)
        .catch(() => {});
    }
  };

  const openOwnerProfile = (index: number) => {
    const a = filteredActivities[index];
    if (!a) return;
    navigation.navigate('UserProfile', {
      userId: a.ownerId,
      name: a.ownerName,
      avatarUrl: a.ownerAvatar,
      rating: a.ownerRating,
    });
  };

  const openChat = async () => {
    // Если фоновое создание чата ещё не завершилось — дождёмся/создадим его.
    const chat =
      matchChat ?? (currentUser && matchActivity ? await createMatchChat(currentUser, matchActivity) : null);
    if (!chat) return;
    const otherId = chat.participants.find((p) => p !== currentUser?.id) ?? '';
    setMatchActivity(null);
    setMatchChat(null);
    navigation.navigate('Chat', {
      chatId: chat.id,
      title: chat.participantNames[otherId] ?? 'Чат',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Go<Text style={{ color: colors.accent }}>Hobby</Text>
        </Text>

        {/* Двойной переключатель: «Рядом» (моё гео) / выбранный город */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, filterMode === 'nearby' && styles.segBtnActive]}
            onPress={() => setFilterMode('nearby')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="navigate"
              size={14}
              color={filterMode === 'nearby' ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.segText, filterMode === 'nearby' && styles.segTextActive]}>
              Рядом
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, filterMode === 'city' && styles.segBtnActive]}
            onPress={() => {
              setFilterMode('city');
              setCityPickerVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={14}
              color={filterMode === 'city' ? '#fff' : colors.textMuted}
            />
            <Text
              style={[styles.segText, filterMode === 'city' && styles.segTextActive]}
              numberOfLines={1}
            >
              {filterMode === 'city' && selectedCity ? selectedCity : 'Город'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateActivity')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Выбор города: ввод с автоподсказками (как в регистрации) + быстрый выбор */}
      <Modal visible={cityPickerVisible} transparent animationType="slide" onRequestClose={() => setCityPickerVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalFlex} activeOpacity={1} onPress={() => setCityPickerVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Выберите город</Text>
              <TouchableOpacity onPress={() => setCityPickerVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <CityField
                value={selectedCity ?? ''}
                onSelect={handleCitySelect}
                placeholder="Введите город"
              />

              {availableCities.length > 0 && (
                <>
                  <Text style={styles.quickLabel}>Города с активностями</Text>
                  <View style={styles.quickWrap}>
                    {availableCities.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.quickChip, selectedCity === c && styles.quickChipActive]}
                        onPress={() => handleQuickCity(c)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={selectedCity === c ? '#fff' : colors.textMuted}
                        />
                        <Text style={[styles.quickChipText, selectedCity === c && styles.quickChipTextActive]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.deck} onLayout={onDeckLayout}>
        {loading ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : allSwiped || filteredActivities.length === 0 ? (
          <View style={styles.empty}>
            {filteredActivities.length === 0 ? (
              // В выбранном городе / рядом нет активностей — предлагаем создать свою.
              <>
                <Ionicons name="location-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {filterMode === 'city' && selectedCity
                    ? `В городе ${selectedCity} пока нет активностей`
                    : 'Рядом пока нет активностей'}
                </Text>
                <Text style={styles.emptyText}>Станьте первым — создайте свою!</Text>
                <TouchableOpacity
                  style={styles.reloadBtn}
                  onPress={() => navigation.navigate('CreateActivity')}
                >
                  <Text style={styles.reloadText}>Создать активность</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Колода пролистана до конца.
              <>
                <Ionicons name="albums-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Карточки закончились</Text>
                <Text style={styles.emptyText}>Загляни позже или обнови ленту</Text>
                <TouchableOpacity style={styles.reloadBtn} onPress={reloadDeck}>
                  <Text style={styles.reloadText}>Обновить</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <Swiper
            key={deckKey}
            ref={swiperRef}
            cards={filteredActivities}
            keyExtractor={(a) => a.id}
            renderCard={(a) => (a ? <Card activity={a} userLocation={myLocation} /> : null)}
            onSwipedRight={handleSwipedRight}
            onSwipedAll={() => setAllSwiped(true)}
            onTapCard={openOwnerProfile}
            cardIndex={0}
            stackSize={3}
            stackScale={6}
            stackSeparation={14}
            backgroundColor="transparent"
            disableTopSwipe
            disableBottomSwipe
            animateOverlayLabelsOpacity
            cardVerticalMargin={12}
            cardHorizontalMargin={16}
            marginTop={0}
            marginBottom={swiperMarginBottom}
            overlayLabels={{
              left: {
                title: 'НЕТ',
                style: {
                  label: styles.overlayNope,
                  wrapper: styles.overlayWrapperRight,
                },
              },
              right: {
                title: 'ИДУ',
                style: {
                  label: styles.overlayLike,
                  wrapper: styles.overlayWrapperLeft,
                },
              },
            }}
          />
        )}

        {!loading && !allSwiped && filteredActivities.length > 0 && (
          <View style={[styles.actions, { bottom: tabBarHeight + 8 }]} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.actionBtn, styles.nopeBtn]}
              onPress={() => swiperRef.current?.swipeLeft()}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={34} color={colors.nope} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.likeBtn]}
              onPress={() => swiperRef.current?.swipeRight()}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={30} color={colors.like} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <MatchModal
        visible={!!matchActivity}
        activity={matchActivity}
        onChat={openChat}
        onClose={() => {
          setMatchActivity(null);
          setMatchChat(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { color: colors.text, fontSize: 22, fontWeight: '800' },
  segment: {
    flexShrink: 1,
    flexDirection: 'row',
    marginHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  segBtnActive: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', maxWidth: 90 },
  segTextActive: { color: '#fff' },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deck: { flex: 1, marginTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  reloadBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: spacing.lg,
  },
  reloadText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    zIndex: 20,
    elevation: 20,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nopeBtn: { borderColor: colors.nope },
  likeBtn: { borderColor: colors.like },
  overlayLike: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.like,
    borderColor: colors.like,
    borderWidth: 4,
    borderRadius: 8,
    padding: 8,
    overflow: 'hidden',
  },
  overlayNope: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.nope,
    borderColor: colors.nope,
    borderWidth: 4,
    borderRadius: 8,
    padding: 8,
    overflow: 'hidden',
  },
  overlayWrapperLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 40,
    marginLeft: 40,
  },
  overlayWrapperRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 40,
    marginRight: 40,
  },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalFlex: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  quickLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  quickChipTextActive: { color: '#fff' },
});
