// SafeView.tsx
// Wraps raw string/number children with <Text> to avoid
// "Unexpected text node" under <View> in React Native.

import React from 'react';
import { View, Text, ViewProps } from 'react-native';

function wrapStringChildren(nodes: React.ReactNode): React.ReactNode {
  return React.Children.map(nodes, (child, idx) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={`txt-${idx}`}>{child}</Text>;
    }
    // Recursively handle fragments
    if (React.isValidElement(child) && child.type === React.Fragment) {
      const props = child.props as { children?: React.ReactNode };
      return (
        <React.Fragment key={`frag-${idx}`}>
          {wrapStringChildren(props.children)}
        </React.Fragment>
      );
    }
    return child;
  });
}

export default function SafeView(
  props: ViewProps & { children?: React.ReactNode }
) {
  const { children, ...rest } = props;
  return <View {...rest}>{wrapStringChildren(children)}</View>;
}