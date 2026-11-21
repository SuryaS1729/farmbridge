import { Stack } from "expo-router";

export default function FarmerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quote" />
      <Stack.Screen name="my-quotes" />
      <Stack.Screen name="farm-details" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="payment-methods" />
    </Stack>
  );
}
