import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CELL_SIZE = 12;
const CELL_GAP = 2;
const WEEKS = 20;

interface Props {
  dates: string[]; // array of 'YYYY-MM-DD' strings
}

export default function CalendarHeatmap({ dates }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of dates) counts[d] = (counts[d] ?? 0) + 1;

    const today = new Date();
    const days: Array<{ date: string; count: number; weekday: number }> = [];

    for (let i = (WEEKS * 7) - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, count: counts[dateStr] ?? 0, weekday: d.getDay() });
    }

    // Pad to align to Sunday start
    const firstWeekday = days[0].weekday;
    const padded = Array.from({ length: firstWeekday }, (_, i) => ({
      date: '',
      count: -1,
      weekday: i,
    }));

    return [...padded, ...days];
  }, [dates]);

  const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  const getColor = (count: number) => {
    if (count < 0) return 'transparent';
    if (count === 0) return colors.surface;
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return colors.primary + '44';
    if (intensity < 0.5) return colors.primary + '88';
    if (intensity < 0.75) return colors.primaryLight + 'AA';
    return colors.primaryLight;
  };

  const weeks: typeof data[] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  // Determine which weeks start a new month for labels
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const firstReal = week.find((d) => d.date);
    if (firstReal) {
      const month = new Date(firstReal.date).getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ col, label: MONTHS[month] });
        lastMonth = month;
      }
    }
  });

  const totalActive = dates.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.totalText}>{totalActive} sightings in the past {WEEKS} weeks</Text>
      </View>

      {/* Month labels */}
      <View style={styles.monthRow}>
        <View style={styles.dayLabelSpacer} />
        <View style={styles.monthLabelsContainer}>
          {monthLabels.map(({ col, label }) => (
            <Text
              key={`${col}-${label}`}
              style={[styles.monthLabel, { left: col * (CELL_SIZE + CELL_GAP) }]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {/* Day of week labels */}
        <View style={styles.dayLabels}>
          {DAYS.map((d, i) => (
            <Text key={i} style={styles.dayLabel}>{i % 2 === 1 ? d : ''}</Text>
          ))}
        </View>

        {/* Columns */}
        <View style={styles.columns}>
          {weeks.map((week, col) => (
            <View key={col} style={styles.column}>
              {week.map((day, row) => (
                <View
                  key={row}
                  style={[
                    styles.cell,
                    { backgroundColor: getColor(day.count) },
                    day.count > 0 && styles.cellActive,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <View
            key={i}
            style={[
              styles.legendCell,
              {
                backgroundColor:
                  intensity === 0
                    ? colors.surface
                    : intensity < 0.25
                    ? colors.primary + '44'
                    : intensity < 0.5
                    ? colors.primary + '88'
                    : intensity < 0.75
                    ? colors.primaryLight + 'AA'
                    : colors.primaryLight,
              },
            ]}
          />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { marginBottom: spacing.sm },
  totalText: { ...typography.caption, color: colors.textSecondary },

  monthRow: { flexDirection: 'row', marginBottom: 4 },
  dayLabelSpacer: { width: 20 },
  monthLabelsContainer: { flex: 1, position: 'relative', height: 14 },
  monthLabel: { ...typography.tiny, color: colors.textMuted, position: 'absolute', fontSize: 9 },

  grid: { flexDirection: 'row' },
  dayLabels: { width: 20, gap: CELL_GAP },
  dayLabel: { ...typography.tiny, color: colors.textMuted, height: CELL_SIZE, lineHeight: CELL_SIZE, fontSize: 9 },

  columns: { flexDirection: 'row', gap: CELL_GAP, flex: 1 },
  column: { gap: CELL_GAP },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  cellActive: { opacity: 1 },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing.sm,
  },
  legendText: { ...typography.tiny, color: colors.textMuted, fontSize: 9 },
  legendCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
});
