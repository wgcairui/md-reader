import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens } from '../src/theme/useTheme';
import { radii, space } from '../src/theme/tokens';
import { useRepoStore } from '../src/store/repoStore';
import { parseGitHubUrl, fetchAndExtract } from '../src/lib/github';
import { importLocalFiles } from '../src/lib/localImport';
import { TopBar } from '../src/components/TopBar';

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useThemeTokens();
  const add = useRepoStore((s) => s.add);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const onPickLocal = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'text/markdown', 'text/x-markdown'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (res.canceled) return;
      const assets = res.assets;
      if (assets.length === 0) return;

      setBusy(true);
      setProgress(`Importing ${assets.length} file${assets.length === 1 ? '' : 's'}…`);
      const imported = await importLocalFiles(assets, (stage, p, msg) => {
        if (stage === 'copy') setProgress(msg || `Copying… ${Math.round(p * 100)}%`);
      });
      add({
        source: {
          kind: 'local',
          rootPath: imported.rootPath,
          displayName: imported.displayName,
          importedAt: Date.now(),
          fileCount: imported.fileCount,
        },
      });
      router.back();
    } catch (e) {
      Alert.alert('Import failed', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const onAddRemote = async () => {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      Alert.alert('Invalid URL', 'Expected https://github.com/owner/name or owner/name');
      return;
    }
    setBusy(true);
    setProgress('Downloading tarball…');
    try {
      const { cacheSlug } = await fetchAndExtract(parsed, (stage: 'download' | 'extract', p: number) => {
        if (stage === 'download') {
          setProgress(`Downloading… ${Math.round(p * 100)}%`);
        } else {
          setProgress(`Extracting… ${Math.round(p * 100)}%`);
        }
      });
      add({
        source: {
          kind: 'remote',
          url: `https://github.com/${parsed.owner}/${parsed.name}`,
          owner: parsed.owner,
          name: parsed.name,
          cacheSlug,
        },
      });
      router.back();
    } catch (e) {
      Alert.alert('Fetch failed', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas.default }} edges={['top']}>
      <TopBar title="Add repository" canGoBack />
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        <Text style={[styles.help, { color: colors.fg.muted }]}>
          Bring a GitHub repo (or its docs folder) onto your device. We'll keep a local cache so
          you can read it offline later.
        </Text>

        <Section title="From GitHub URL" colors={colors}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://github.com/owner/name"
            placeholderTextColor={colors.fg.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              {
                color: colors.fg.default,
                backgroundColor: colors.canvas.subtle,
                borderColor: colors.border.default,
              },
            ]}
          />
          <PrimaryButton
            label={busy ? progress || 'Working…' : 'Download'}
            onPress={onAddRemote}
            disabled={busy || !url.trim()}
            loading={busy}
            colors={colors}
          />
        </Section>

        <Section title="From local files" colors={colors}>
          <Text style={[styles.muted, { color: colors.fg.muted }]}>
            Pick one or more markdown files (you can multi-select). We'll bundle them into a virtual
            repo you can browse offline. For an entire GitHub repo, paste the URL above.
          </Text>
          <SecondaryButton
            label={busy ? progress || 'Working…' : 'Pick markdown files'}
            onPress={onPickLocal}
            disabled={busy}
            loading={busy}
            colors={colors}
          />
        </Section>

        {busy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.accent.fg} />
            <Text style={{ color: colors.fg.muted, marginLeft: 8 }}>{progress}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useThemeTokens>['colors'];
}) {
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.canvas.overlay, borderColor: colors.border.default },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.fg.default }]}>{title}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  colors: ReturnType<typeof useThemeTokens>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        {
          backgroundColor: disabled
            ? colors.border.muted
            : pressed
              ? colors.accent.emphasis
              : colors.accent.fg,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{label}</Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
  loading,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  colors: ReturnType<typeof useThemeTokens>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        {
          backgroundColor: pressed ? colors.canvas.subtle : 'transparent',
          borderColor: colors.border.default,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg.default} />
      ) : (
        <Text style={{ color: colors.fg.default, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      )}
    </Pressable>
  );
}



const styles = StyleSheet.create({
  help: { fontSize: 13, lineHeight: 20, marginBottom: space[4] },
  section: {
    padding: space[4],
    borderRadius: radii.large,
    borderWidth: 1,
    marginBottom: space[4],
    gap: space[3],
  },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  input: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radii.medium,
    borderWidth: 1,
    fontSize: 14,
  },
  muted: { fontSize: 13, lineHeight: 20 },
  primary: {
    paddingVertical: space[3],
    borderRadius: radii.medium,
    alignItems: 'center',
  },
  secondary: {
    paddingVertical: space[3],
    borderRadius: radii.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
  },
});