import React from "react";
import type { Preview } from "@storybook/react";
import { ColorModeProvider } from "../src/theme";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ColorModeProvider>
        <Story />
      </ColorModeProvider>
    ),
  ],
};

export default preview;
