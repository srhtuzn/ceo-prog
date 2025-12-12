import React from "react";
import {
  Table,
  Tag,
  Badge,
  Button,
  Row,
  Col,
  Avatar,
  Tooltip,
  Calendar,
} from "antd";
import {
  ClockCircleOutlined,
  EditOutlined,
  PaperClipOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";

// --- STİL TANIMLARI ---
const COLUMN_STYLES = {
  Bekliyor: {
    color: "#1890ff",
    bg: "#e6f7ff",
    border: "1px solid #91d5ff",
    titleBg: "#bae7ff",
  },
  "Onay Bekliyor": {
    color: "#faad14",
    bg: "#fffbe6",
    border: "1px solid #ffe58f",
    titleBg: "#fff1b8",
  },
  Yapıldı: {
    color: "#52c41a",
    bg: "#f6ffed",
    border: "1px solid #b7eb8f",
    titleBg: "#d9f7be",
  },
};

// --- YARDIMCI BİLEŞENLER ---
const KanbanCard = ({ gorev, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: gorev.id.toString(),
      data: { gorev },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 999 : "auto",
        opacity: isDragging ? 0.6 : 1,
        cursor: "grab",
      }
    : undefined;

  const borderLeftColor =
    gorev.oncelik === "Yüksek"
      ? "#ff4d4f"
      : gorev.oncelik === "Orta"
      ? "#faad14"
      : "#1890ff";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 12 }}
      {...listeners}
      {...attributes}
    >
      <div
        onClick={onClick}
        style={{
          background: "white",
          padding: "12px",
          borderRadius: "6px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          borderLeft: `4px solid ${borderLeftColor}`,
          border: "1px solid #f0f0f0",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            #{gorev.id} - {gorev.baslik}
          </span>
          {gorev.dosya_yolu && (
            <PaperClipOutlined style={{ color: "#1890ff" }} />
          )}
        </div>
        {gorev.proje_adi && (
          <div style={{ marginBottom: 8 }}>
            <Tag
              style={{
                fontSize: 10,
                border: 0,
                background: "#f0f5ff",
                color: "#2f54eb",
              }}
            >
              {gorev.proje_adi}
            </Tag>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Avatar.Group max={{ count: 3 }} size="small">
            {gorev.atananlar_listesi?.map((kisi) => (
              <Tooltip title={kisi.ad_soyad} key={kisi.id}>
                {kisi.avatar ? (
                  <Avatar src={`${API_URL}/uploads/${kisi.avatar}`} />
                ) : (
                  <Avatar style={{ backgroundColor: "#87d068" }}>
                    {kisi.ad_soyad?.[0]}
                  </Avatar>
                )}
              </Tooltip>
            ))}
          </Avatar.Group>
          <span style={{ color: "#999", fontSize: 10 }}>
            {dayjs(gorev.tarih).format("DD MMM")}
          </span>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ id, title, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const style = COLUMN_STYLES[id] || COLUMN_STYLES["Bekliyor"];

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "#ffffff" : style.bg,
        border: isOver ? `2px dashed ${style.color}` : style.border,
        borderRadius: 8,
        minHeight: "calc(100vh - 240px)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "10px 15px",
          borderBottom: style.border,
          background: style.titleBg,
          borderRadius: "8px 8px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ color: "#444", fontSize: 13 }}>{title}</strong>
        <Badge
          count={children.length}
          style={{
            backgroundColor: "white",
            color: style.color,
            boxShadow: "none",
          }}
        />
      </div>
      <div style={{ padding: 10, flex: 1 }}>
        {children.length > 0 ? (
          children
        ) : (
          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              color: "#ccc",
              fontSize: 12,
            }}
          >
            Görev Yok
          </div>
        )}
      </div>
    </div>
  );
};

export default function GorevListesi({
  viewMode,
  gorevler,
  yukleniyor,
  onDetayAc,
  onDragEnd,
  onTakvimGunTikla,
  takvimCellRender,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  // Tablo Kolonları
  const columns = [
    {
      title: "Proje",
      dataIndex: "proje_adi",
      width: 150,
      render: (ad) => (ad ? <Tag color="geekblue">{ad}</Tag> : "-"),
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => (
        <a onClick={() => onDetayAc(r)} style={{ fontWeight: 600 }}>
          #{r.id} - {t}
        </a>
      ),
    },
    {
      title: "Sorumlular",
      dataIndex: "atananlar_listesi",
      width: 120,
      render: (kisiler) => (
        <Avatar.Group max={{ count: 3 }} size="small">
          {kisiler?.map((k) => (
            <Tooltip title={k.ad_soyad} key={k.id}>
              {k.avatar ? (
                <Avatar src={`${API_URL}/uploads/${k.avatar}`} />
              ) : (
                <Avatar style={{ backgroundColor: "#87d068" }}>
                  {k.ad_soyad?.[0]}
                </Avatar>
              )}
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: "Bitiş",
      dataIndex: "tarih",
      width: 130,
      render: (t) => {
        if (!t) return "-";
        const d = dayjs(t);
        const diff = d.diff(dayjs(), "day");
        return (
          <Tag
            color={diff < 0 ? "error" : diff <= 3 ? "warning" : "success"}
            icon={<ClockCircleOutlined />}
          >
            {d.format("DD MMM")}
          </Tag>
        );
      },
    },
    {
      title: "Durum",
      dataIndex: "durum",
      width: 120,
      render: (d) => (
        <Tag
          color={
            d === "Yapıldı" ? "green" : d.includes("Onay") ? "gold" : "blue"
          }
        >
          {d}
        </Tag>
      ),
    },
    {
      title: "İşlem",
      width: 80,
      align: "center",
      render: (_, r) => (
        <Button
          size="small"
          type="link"
          icon={<EditOutlined />}
          onClick={() => onDetayAc(r)}
        />
      ),
    },
  ];

  return (
    <>
      {viewMode === "list" && (
        <Table
          columns={columns}
          dataSource={gorevler}
          rowKey="id"
          loading={yukleniyor}
          pagination={{ pageSize: 10 }}
        />
      )}

      {viewMode === "board" && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <Row gutter={16}>
            {["Bekliyor", "Onay Bekliyor", "Yapıldı"].map((status) => (
              <Col span={8} key={status}>
                <KanbanColumn
                  id={status}
                  title={
                    status === "Bekliyor"
                      ? "YAPILACAKLAR"
                      : status === "Yapıldı"
                      ? "TAMAMLANANLAR"
                      : "ONAY / İŞLEMDE"
                  }
                >
                  {gorevler
                    .filter((g) => g.durum === status)
                    .map((g) => (
                      <KanbanCard
                        key={g.id}
                        gorev={g}
                        onClick={() => onDetayAc(g)}
                      />
                    ))}
                </KanbanColumn>
              </Col>
            ))}
          </Row>
        </DndContext>
      )}

      {viewMode === "calendar" && (
        <Calendar onSelect={onTakvimGunTikla} cellRender={takvimCellRender} />
      )}
    </>
  );
}
