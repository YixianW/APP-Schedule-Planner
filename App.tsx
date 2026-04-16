import 'react-native-gesture-handler';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { generateOptimizedPlan } from './src/services/anthropic';
import { loadEvents, loadPlan, saveEvents, savePlan } from './src/storage';
import type { EventItem, PlanItem } from './src/types';
import { formatReadableDate, parseTimeInput } from './src/utils/dates';

type RootStackParamList = {
  Home: undefined;
  Plan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type EventFormState = {
  name: string;
  time: string;
  location: string;
  notes: string;
};

const emptyForm: EventFormState = {
  name: '',
  time: '',
  location: '',
  notes: '',
};

function App() {
  useEffect(() => {
    // Android sometimes renders the status bar behind the app chrome unless we set it explicitly.
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#f8f4ee');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <ExpoStatusBar style="dark" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#f4efe7' },
              headerShadowVisible: false,
              headerTintColor: '#2c2a28',
              contentStyle: { backgroundColor: '#f8f4ee' },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AI Schedule Planner' }} />
            <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'Your Optimized Schedule' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function HomeScreen({ navigation }: { navigation: { navigate: (screen: 'Plan') => void } }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    try {
      const savedEvents = await loadEvents();
      setEvents(sortEvents(savedEvents));
    } catch {
      Alert.alert('Storage error', 'The app could not load saved events.');
    } finally {
      setLoading(false);
    }
  }

  async function persistEvents(nextEvents: EventItem[]) {
    setEvents(nextEvents);
    try {
      await saveEvents(nextEvents);
    } catch {
      Alert.alert('Storage error', 'Could not save your events locally.');
    }
  }

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalVisible(true);
  }

  function openEditModal(event: EventItem) {
    setEditingId(event.id);
    setForm({
      name: event.name,
      time: event.time,
      location: event.location,
      notes: event.notes,
    });
    setFormError('');
    setModalVisible(true);
  }

  async function handleSaveEvent() {
    const cleanedName = form.name.trim();
    const cleanedTime = form.time.trim();

    if (!cleanedName) {
      setFormError('Event name is required.');
      return;
    }

    if (!parseTimeInput(cleanedTime)) {
      setFormError('Enter a valid time like 9:15 AM or 14:30.');
      return;
    }

    const nextEvent: EventItem = {
      id: editingId ?? String(Date.now()),
      name: cleanedName,
      time: cleanedTime,
      location: form.location.trim(),
      notes: form.notes.trim(),
      updatedAt: Date.now(),
    };

    const nextEvents = editingId
      ? sortEvents(events.map((event) => (event.id === editingId ? nextEvent : event)))
      : sortEvents([...events, nextEvent]);

    await persistEvents(nextEvents);
    setModalVisible(false);
  }

  async function handleDeleteEvent(id: string) {
    const nextEvents = events.filter((event) => event.id !== id);
    await persistEvents(nextEvents);
  }

  async function handleGeneratePlan() {
    setBannerError('');

    if (events.length === 0) {
      setBannerError('Add at least one event before generating a plan.');
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setBannerError('Missing EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateOptimizedPlan(events, apiKey);
      await savePlan(response.plan, response.rawText);
      navigation.navigate('Plan');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate a plan.';
      setBannerError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#7b5d45" />
        <Text style={styles.loadingText}>Loading your saved events…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>{formatReadableDate(new Date())}</Text>
          <Text style={styles.heroTitle}>AI Schedule Planner</Text>
          <Text style={styles.heroBody}>
            Add everything you need to do today, then let Claude turn it into a more realistic schedule.
          </Text>
        </View>

        {bannerError ? <Text style={styles.errorBanner}>{bannerError}</Text> : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today&apos;s Events</Text>
          <Text style={styles.sectionSubtitle}>{events.length} item(s)</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>Tap Add Event to enter your first item for the day.</Text>
          </View>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={() => openEditModal(event)}
              onDelete={() => void handleDeleteEvent(event.id)}
            />
          ))
        )}

        <View style={styles.primaryActions}>
          <ActionButton label="Add Event" onPress={openAddModal} variant="secondary" />
          <ActionButton
            label={isGenerating ? 'Generating…' : 'Generate Plan'}
            onPress={() => void handleGeneratePlan()}
            variant="primary"
            disabled={isGenerating}
          />
        </View>
      </ScrollView>

      <EventFormModal
        visible={modalVisible}
        title={editingId ? 'Edit Event' : 'Add Event'}
        form={form}
        error={formError}
        onClose={() => setModalVisible(false)}
        onChange={setForm}
        onSave={() => void handleSaveEvent()}
      />
    </SafeAreaView>
  );
}

function PlanScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [rawPlanText, setRawPlanText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    try {
      const savedPlan = await loadPlan();
      setPlan(savedPlan.items);
      setRawPlanText(savedPlan.rawText);
    } catch {
      Alert.alert('Storage error', 'The app could not load the saved plan.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlan() {
    try {
      await savePlan(plan, rawPlanText);
      setSaveMessage('Plan saved locally.');
    } catch {
      Alert.alert('Storage error', 'Could not save the plan.');
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#7b5d45" />
        <Text style={styles.loadingText}>Loading your most recent plan…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.planIntroCard}>
          <Text style={styles.heroTitle}>Your Optimized Schedule</Text>
          <Text style={styles.heroBody}>
            This timeline reflects the latest response saved from Claude. You can go back and change the
            event list at any time.
          </Text>
        </View>

        {plan.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No plan saved yet</Text>
            <Text style={styles.emptyText}>Generate a plan from the home screen to see it here.</Text>
          </View>
        ) : (
          plan.map((item, index) => (
            <PlanTimelineItem key={`${item.time}-${index}`} item={item} isLast={index === plan.length - 1} />
          ))
        )}

        {rawPlanText ? (
          <View style={styles.rawBlock}>
            <Text style={styles.rawTitle}>Claude Response</Text>
            <Text style={styles.rawText}>{rawPlanText}</Text>
          </View>
        ) : null}

        {saveMessage ? <Text style={styles.successBanner}>{saveMessage}</Text> : null}

        <View style={styles.primaryActions}>
          <ActionButton label="Back" onPress={navigation.goBack} variant="secondary" />
          <ActionButton label="Save Plan" onPress={() => void handleSavePlan()} variant="primary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: EventItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{event.name}</Text>
          <Text style={styles.cardTime}>{event.time}</Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.textAction} onPress={onEdit}>
            <Text style={styles.textActionLabel}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.textAction, styles.deleteAction]} onPress={onDelete}>
            <Text style={[styles.textActionLabel, styles.deleteLabel]}>Delete</Text>
          </Pressable>
        </View>
      </View>

      {event.location ? <Text style={styles.cardMeta}>Location: {event.location}</Text> : null}
      {event.notes ? <Text style={styles.cardMeta}>Notes: {event.notes}</Text> : null}
    </View>
  );
}

function PlanTimelineItem({ item, isLast }: { item: PlanItem; isLast: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCard}>
        <Text style={styles.timelineTime}>{item.time}</Text>
        <Text style={styles.timelineTitle}>{item.action}</Text>
        <Text style={styles.timelineReason}>{item.reason}</Text>
      </View>
    </View>
  );
}

function EventFormModal({
  visible,
  title,
  form,
  error,
  onClose,
  onChange,
  onSave,
}: {
  visible: boolean;
  title: string;
  form: EventFormState;
  error: string;
  onClose: () => void;
  onChange: (value: EventFormState) => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>Time accepts formats like 9:15 AM or 14:30.</Text>

          <TextInput
            style={styles.input}
            placeholder="Event name *"
            value={form.name}
            onChangeText={(name) => onChange({ ...form, name })}
          />
          <TextInput
            style={styles.input}
            placeholder="Time *"
            value={form.time}
            onChangeText={(time) => onChange({ ...form, time })}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={form.location}
            onChangeText={(location) => onChange({ ...form, location })}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Notes"
            value={form.notes}
            onChangeText={(notes) => onChange({ ...form, notes })}
            multiline
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <ActionButton label="Cancel" onPress={onClose} variant="secondary" />
            <ActionButton label="Save" onPress={onSave} variant="primary" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionButton({
  label,
  onPress,
  variant,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        disabled ? styles.disabledButton : null,
        pressed && !disabled ? styles.pressedButton : null,
      ]}
    >
      <Text style={[styles.actionButtonLabel, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

function sortEvents(events: EventItem[]) {
  return [...events].sort((left, right) => {
    const leftMinutes = parseTimeInput(left.time)?.minutes ?? 0;
    const rightMinutes = parseTimeInput(right.time)?.minutes ?? 0;
    return leftMinutes - rightMinutes || left.updatedAt - right.updatedAt;
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f4ee',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#f2dfcf',
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  planIntroCard: {
    backgroundColor: '#e7efe7',
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  heroKicker: {
    color: '#7b5d45',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#2c2a28',
    fontSize: 28,
    fontWeight: '800',
  },
  heroBody: {
    color: '#4f4a45',
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#2c2a28',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#756a60',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fffaf4',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee2d6',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  cardTitle: {
    color: '#2c2a28',
    fontSize: 18,
    fontWeight: '800',
  },
  cardTime: {
    color: '#7b5d45',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  cardMeta: {
    color: '#5d5550',
    fontSize: 14,
    lineHeight: 20,
  },
  cardActions: {
    gap: 8,
    alignItems: 'flex-end',
  },
  textAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f3ede7',
  },
  deleteAction: {
    backgroundColor: '#fae5e2',
  },
  textActionLabel: {
    color: '#2c2a28',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteLabel: {
    color: '#9a382f',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2c2a28',
  },
  secondaryButton: {
    backgroundColor: '#e9dfd3',
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  primaryLabel: {
    color: '#fffaf4',
  },
  secondaryLabel: {
    color: '#2c2a28',
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressedButton: {
    transform: [{ scale: 0.99 }],
  },
  emptyState: {
    paddingVertical: 26,
    paddingHorizontal: 18,
    backgroundColor: '#fffaf4',
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#dbc8b5',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#2c2a28',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#6a6159',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f4ee',
    gap: 16,
  },
  loadingText: {
    color: '#5d5550',
    fontSize: 15,
  },
  errorBanner: {
    color: '#8f332b',
    backgroundColor: '#fae5e2',
    borderRadius: 14,
    padding: 12,
    fontWeight: '600',
  },
  successBanner: {
    color: '#2f5a2d',
    backgroundColor: '#e3f0df',
    borderRadius: 14,
    padding: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 42, 40, 0.42)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#f8f4ee',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: '#2c2a28',
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#6b635d',
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#dfd2c3',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#2c2a28',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  errorText: {
    color: '#8f332b',
    fontSize: 13,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7b5d45',
    marginTop: 18,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#dccabb',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#fffaf4',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee2d6',
    gap: 6,
  },
  timelineTime: {
    color: '#7b5d45',
    fontSize: 13,
    fontWeight: '800',
  },
  timelineTitle: {
    color: '#2c2a28',
    fontSize: 16,
    fontWeight: '800',
  },
  timelineReason: {
    color: '#5d5550',
    fontSize: 14,
    lineHeight: 20,
  },
  rawBlock: {
    backgroundColor: '#fffaf4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee2d6',
    padding: 16,
    gap: 8,
  },
  rawTitle: {
    color: '#2c2a28',
    fontSize: 16,
    fontWeight: '800',
  },
  rawText: {
    color: '#5d5550',
    fontSize: 14,
    lineHeight: 20,
  },
});

function sortEvents(events: EventItem[]) {
  return [...events].sort((left, right) => {
    const leftMinutes = parseTimeInput(left.time)?.minutes ?? 0;
    const rightMinutes = parseTimeInput(right.time)?.minutes ?? 0;
    return leftMinutes - rightMinutes || left.updatedAt - right.updatedAt;
  });
}

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: EventItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{event.name}</Text>
          <Text style={styles.cardTime}>{event.time}</Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.textAction} onPress={onEdit}>
            <Text style={styles.textActionLabel}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.textAction, styles.deleteAction]} onPress={onDelete}>
            <Text style={[styles.textActionLabel, styles.deleteLabel]}>Delete</Text>
          </Pressable>
        </View>
      </View>

      {event.location ? <Text style={styles.cardMeta}>Location: {event.location}</Text> : null}
      {event.notes ? <Text style={styles.cardMeta}>Notes: {event.notes}</Text> : null}
    </View>
  );
}

function PlanTimelineItem({ item, isLast }: { item: PlanItem; isLast: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineDot} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCard}>
        <Text style={styles.timelineTime}>{item.time}</Text>
        <Text style={styles.timelineTitle}>{item.action}</Text>
        <Text style={styles.timelineReason}>{item.reason}</Text>
      </View>
    </View>
  );
}

function EventFormModal({
  visible,
  title,
  form,
  error,
  onClose,
  onChange,
  onSave,
}: {
  visible: boolean;
  title: string;
  form: EventFormState;
  error: string;
  onClose: () => void;
  onChange: (value: EventFormState) => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>Time accepts formats like 9:15 AM or 14:30.</Text>

          <TextInput
            style={styles.input}
            placeholder="Event name *"
            value={form.name}
            onChangeText={(name) => onChange({ ...form, name })}
          />
          <TextInput
            style={styles.input}
            placeholder="Time *"
            value={form.time}
            onChangeText={(time) => onChange({ ...form, time })}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            value={form.location}
            onChangeText={(location) => onChange({ ...form, location })}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Notes"
            value={form.notes}
            onChangeText={(notes) => onChange({ ...form, notes })}
            multiline
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <ActionButton label="Cancel" onPress={onClose} variant="secondary" />
            <ActionButton label="Save" onPress={onSave} variant="primary" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionButton({
  label,
  onPress,
  variant,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        disabled ? styles.disabledButton : null,
        pressed && !disabled ? styles.pressedButton : null,
      ]}
    >
      <Text style={[styles.actionButtonLabel, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default App;