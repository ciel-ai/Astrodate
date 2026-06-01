const fs = require('fs');
let data = fs.readFileSync('app/_layout.tsx', 'utf8');

data = data.replace(
  "import { AuthAlertProvider } from '@/lib/auth-alert-context';",
  "import { AuthAlertProvider } from '@/lib/auth-alert-context';\nimport { SubscriptionProvider } from '@/hooks/useSubscriptionStatus';"
);

data = data.replace(
  "<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>\n          <Stack",
  "<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>\n          <SubscriptionProvider>\n          <Stack"
);

data = data.replace(
  "          <StatusBar\n            style=\"auto\"\n            translucent={false}\n            backgroundColor={Platform.OS === 'android' ? '#1A0B2E' : undefined}\n          />\n        </ThemeProvider>",
  "          <StatusBar\n            style=\"auto\"\n            translucent={false}\n            backgroundColor={Platform.OS === 'android' ? '#1A0B2E' : undefined}\n          />\n          </SubscriptionProvider>\n        </ThemeProvider>"
);

fs.writeFileSync('app/_layout.tsx', data);
