import { Pressable, ScrollView, Text } from "react-native";

type FilterTab = {
  key: string;
  label: string;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function FilterTabs({ tabs, activeKey, onSelect }: FilterTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, alignItems: "center" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            className="rounded-full border px-4"
            style={{
              height: 32,
              justifyContent: "center",
              backgroundColor: isActive ? "#A078E8" : "transparent",
              borderColor: isActive ? "#A078E8" : "#3A3A3A",
            }}
          >
            <Text
              className="font-poppins-medium text-xs"
              style={{ color: isActive ? "#FFFFFF" : "#8A8A8A" }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
