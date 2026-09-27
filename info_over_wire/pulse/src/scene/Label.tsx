import { Billboard, Text } from '@react-three/drei';

/**
 * Beschriftung im 3D-Raum.
 *
 * Zwei Eigenschaften machen den Unterschied zur nackten <Text>-Komponente:
 *   - Billboard: dreht sich immer zur Kamera. Sobald die Betrachterin die
 *     Ansicht drehen darf, stehen feste Schilder sonst irgendwann hochkant
 *     oder spiegelverkehrt im Raum.
 *   - outline: dunkler Rand um jede Glyphe. Ohne ihn verschwindet heller Text
 *     vor hellen Bauteilen (Magnetics, Kupfer) komplett.
 */
export default function Label({
  position, children, size = 0.01, color = '#E6EAF0',
  anchorX = 'center', anchorY = 'middle', opacity = 1,
}: {
  position: [number, number, number];
  children: string;
  size?: number;
  color?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  opacity?: number;
}) {
  return (
    <Billboard position={position}>
      <Text
        fontSize={size}
        color={color}
        anchorX={anchorX}
        anchorY={anchorY}
        maxWidth={size * 18}
        textAlign="center"
        lineHeight={1.3}
        fillOpacity={opacity}
        outlineWidth={size * 0.13}
        outlineColor="#05070A"
        outlineOpacity={0.9}
      >
        {children}
      </Text>
    </Billboard>
  );
}
