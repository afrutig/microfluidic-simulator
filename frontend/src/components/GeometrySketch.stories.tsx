import type { Meta, StoryObj } from "@storybook/react";

import GeometrySketch from "./GeometrySketch";

const meta: Meta<typeof GeometrySketch> = {
  title: "Components/GeometrySketch",
  component: GeometrySketch,
};

export default meta;
type Story = StoryObj<typeof GeometrySketch>;

export const Default: Story = {
  args: { width: 1e-3, height: 1e-4 },
};
