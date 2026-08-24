import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Report structure follows Section 24 exactly: product/project/customer/
// Master Sample/batch/inspector/status header, then measurements,
// observations, corrective actions, approvals, timeline.

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#171717" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#737373", marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 8, borderBottom: "1 solid #e5e5e5", paddingBottom: 4 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 130, color: "#737373" },
  value: { flex: 1, fontWeight: 500 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", padding: 4, fontWeight: 700 },
  tableRow: { flexDirection: "row", padding: 4, borderBottom: "1 solid #f0f0f0" },
  col: { flex: 1 },
  colWide: { flex: 2 },
  badge: { fontSize: 8, fontWeight: 700 },
  empty: { color: "#a3a3a3", fontStyle: "italic" },
});

export type ReportData = {
  product: { productId: string; name: string; category: string; status: string };
  project: { name: string; customerName: string };
  masterSample: { masterVersionNumber: string; versionNumber: string } | null;
  batch: { batchCode: string; productionDate: string; supplier: string | null } | null;
  inspector: string;
  generatedAt: string;
  measurements: {
    name: string;
    referenceValue: number;
    unit: string;
    measuredValue: number;
    result: string;
  }[];
  observations: {
    observationCode: string;
    category: string;
    severity: string;
    status: string;
    description: string;
  }[];
  correctiveActions: { description: string; status: string; observationCode: string }[];
  approvals: { label: string; approvedBy: string; approvedDate: string; status: string }[];
  timeline: { date: string; description: string }[];
};

export function ProductQualityReport({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Product Quality Report</Text>
        <Text style={styles.subtitle}>Generated {new Date(data.generatedAt).toLocaleString()}</Text>

        <View>
          <Row label="Product" value={`${data.product.name} (${data.product.productId})`} />
          <Row label="Category" value={data.product.category} />
          <Row label="Project" value={data.project.name} />
          <Row label="Customer" value={data.project.customerName} />
          {data.masterSample && (
            <Row
              label="Master Sample"
              value={`${data.masterSample.masterVersionNumber} (${data.masterSample.versionNumber})`}
            />
          )}
          {data.batch && (
            <>
              <Row label="Production Batch" value={data.batch.batchCode} />
              <Row label="Production Date" value={new Date(data.batch.productionDate).toLocaleDateString()} />
              {data.batch.supplier && <Row label="Supplier" value={data.batch.supplier} />}
            </>
          )}
          <Row label="Inspector" value={data.inspector} />
          <Row label="Overall Status" value={data.product.status.replace(/_/g, " ")} />
        </View>

        <Text style={styles.sectionTitle}>Measurements</Text>
        {data.measurements.length === 0 ? (
          <Text style={styles.empty}>No measurements recorded.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={styles.colWide}>Measurement</Text>
              <Text style={styles.col}>Reference</Text>
              <Text style={styles.col}>Measured</Text>
              <Text style={styles.col}>Result</Text>
            </View>
            {data.measurements.map((m, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.colWide}>{m.name}</Text>
                <Text style={styles.col}>
                  {m.referenceValue} {m.unit}
                </Text>
                <Text style={styles.col}>
                  {m.measuredValue} {m.unit}
                </Text>
                <Text style={styles.col}>{m.result}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Observations</Text>
        {data.observations.length === 0 ? (
          <Text style={styles.empty}>No observations recorded.</Text>
        ) : (
          data.observations.map((o, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: 700 }}>
                {o.observationCode} — {o.category} ({o.severity})
              </Text>
              <Text>{o.description}</Text>
              <Text style={{ color: "#737373" }}>Status: {o.status.replace(/_/g, " ")}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Corrective Actions</Text>
        {data.correctiveActions.length === 0 ? (
          <Text style={styles.empty}>No corrective actions recorded.</Text>
        ) : (
          data.correctiveActions.map((ca, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colWide}>{ca.description}</Text>
              <Text style={styles.col}>{ca.observationCode}</Text>
              <Text style={styles.col}>{ca.status}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Approvals</Text>
        {data.approvals.length === 0 ? (
          <Text style={styles.empty}>No approvals recorded.</Text>
        ) : (
          data.approvals.map((a, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colWide}>{a.label}</Text>
              <Text style={styles.col}>{a.approvedBy}</Text>
              <Text style={styles.col}>{new Date(a.approvedDate).toLocaleDateString()}</Text>
              <Text style={styles.col}>{a.status}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Timeline</Text>
        {data.timeline.map((t, i) => (
          <View style={styles.row} key={i}>
            <Text style={{ width: 90, color: "#737373" }}>{new Date(t.date).toLocaleDateString()}</Text>
            <Text style={{ flex: 1 }}>{t.description}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
