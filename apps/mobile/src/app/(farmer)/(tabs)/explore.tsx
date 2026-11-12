import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const learningAreas = [
  {
    number: "01",
    title: "Crop advisory",
    description: "Guidance for growing and caring for cocoa.",
    topics: [
      "Cocoa farming practices",
      "Organic farming",
      "Model farming",
      "Manures & pesticides",
      "Farm traceability",
      "Farm certification",
    ],
  },
  {
    number: "02",
    title: "Post-harvest",
    description: "Steps that help improve cocoa bean quality.",
    topics: [
      "Bean quality improvement",
      "Cocoa pod harvesting",
      "Fermentation",
      "Drying",
      "Grading",
      "Cleaning",
      "Storage",
    ],
  },
] as const;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Space.four,
            paddingBottom: insets.bottom + BottomTabInset + Space.four,
          },
        ]}
      >
        <View style={styles.brandBar}>
          <ThemedText type="smallBold" style={styles.wordmark}>
            FARMBRIDGE
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            LEARN · COCOA
          </ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText type="title">Cocoa, from pod to bean.</ThemedText>
          <ThemedText themeColor="textSecondary">
            Practical topics for growing cocoa and handling the harvest.
          </ThemedText>
        </View>

        <View style={styles.sectionHeading}>
          <ThemedText type="label" themeColor="textSecondary">
            LEARNING AREAS
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            02 AREAS
          </ThemedText>
        </View>

        {learningAreas.map((area) => (
          <LearningAreaCard key={area.number} {...area} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

type LearningArea = (typeof learningAreas)[number];

function LearningAreaCard({
  number,
  title,
  description,
  topics,
}: LearningArea) {
  const theme = useTheme();

  return (
    <Card style={styles.learningCard}>
      <View style={styles.cardHeading}>
        <ThemedText type="figure" themeColor="textSecondary">
          {number}
        </ThemedText>
        <ThemedText type="label" themeColor="textSecondary">
          COCOA EDUCATION
        </ThemedText>
      </View>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{description}</ThemedText>
      <View style={styles.topicList}>
        {topics.map((topic) => (
          <View
            key={topic}
            style={[styles.topic, { borderColor: theme.border }]}
          >
            <ThemedText type="label" themeColor="textSecondary">
              {topic}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: Space.section,
    paddingHorizontal: Space.page,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    letterSpacing: 2,
  },
  intro: {
    gap: Space.two,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: -Space.two,
  },
  learningCard: {
    gap: Space.three,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topicList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.two,
  },
  topic: {
    paddingHorizontal: Space.two,
    paddingVertical: Space.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
  },
});
