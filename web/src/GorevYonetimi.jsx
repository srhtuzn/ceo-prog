import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Card,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  Typography,
  Popconfirm,
  Upload,
  Divider,
  Badge,
  Row,
  Col,
  List,
  Checkbox,
  Avatar,
  Mentions,
  Calendar,
  Tooltip,
  Drawer,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  PaperClipOutlined,
  SearchOutlined,
  FilterOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  SaveOutlined,
  EditOutlined,
  ClockCircleOutlined,
  DragOutlined,
  FolderAddOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileOutlined,
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
import "dayjs/locale/tr";
import locale from "antd/es/date-picker/locale/tr_TR";

dayjs.locale("tr");

const { Text, Title } = Typography;
const { Option } = Select;
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

// --- YARDIMCI: KULLANICI AVATARI BULMA ---
// İsimden kullanıcıyı bulup avatar dosyasını gösterir, yoksa baş harf
const getUserAvatar = (name, usersList = []) => {
  const user = usersList.find((u) => u.ad_soyad === name);
  if (user && user.avatar) {
    return (
      <Avatar src={`${API_URL}/uploads/${user.avatar}`}>
        {user.ad_soyad?.[0]}
      </Avatar>
    );
  }
  return (
    <Avatar style={{ backgroundColor: "#87d068" }}>
      {name ? name[0] : "?"}
    </Avatar>
  );
};

// --- KANBAN KART ---
const KanbanCard = ({ gorev, onClick, allUsers }) => {
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
          borderLeftWidth: "4px",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        className="kanban-card"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text strong style={{ fontSize: 13 }} ellipsis>
            #{gorev.id} - {gorev.baslik}
          </Text>
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
            {gorev.atananlar?.map((k, i) => (
              <Tooltip title={k} key={i}>
                {getUserAvatar(k, allUsers)}
              </Tooltip>
            ))}
          </Avatar.Group>

          <Text type="secondary" style={{ fontSize: 10 }}>
            {dayjs(gorev.tarih).format("DD MMM")}
          </Text>
        </div>
      </div>
    </div>
  );
};

// --- KANBAN KOLON ---
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
        transition: "all 0.3s",
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
        <Text strong style={{ color: "#444", fontSize: 13 }}>
          {title}
        </Text>
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

// --- DOSYA İKONU ---
const getFileIcon = (fileName) => {
  if (!fileName) return <FileOutlined />;
  if (fileName.endsWith(".pdf"))
    return <FilePdfOutlined style={{ color: "red" }} />;
  if (fileName.match(/\.(jpg|jpeg|png|gif)$/))
    return <FileImageOutlined style={{ color: "purple" }} />;
  if (fileName.match(/\.(xls|xlsx|csv)$/))
    return <FileExcelOutlined style={{ color: "green" }} />;
  return <FileOutlined />;
};

export default function GorevYonetimi({
  aktifKullanici,
  projeler = [],
  kullanicilar,
  bildirimler,
  acilacakGorevId,
  viewMode,
  projeModalAc,
}) {
  const [gorevler, setGorevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [formYukleniyor, setFormYukleniyor] = useState(false);

  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDurum, setFiltreDurum] = useState(null);
  const [filtreOncelik, setFiltreOncelik] = useState(null);
  const [sadeceBenim, setSadeceBenim] = useState(false);

  const [modalAcik, setModalAcik] = useState(false);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [takvimGunModal, setTakvimGunModal] = useState(false);

  const [seciliGunIsleri, setSeciliGunIsleri] = useState([]);
  const [seciliTarih, setSeciliTarih] = useState("");
  const [seciliGorev, setSeciliGorev] = useState(null);
  const [seciliGorevDosyalari, setSeciliGorevDosyalari] = useState([]);
  const [altGorevler, setAltGorevler] = useState([]);
  const [yeniAltGorev, setYeniAltGorev] = useState("");
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState("");

  const [form] = Form.useForm();
  const [detayForm] = Form.useForm();

  const YONETICILER = [
    "Genel Müdür",
    "Departman Müdürü",
    "Süpervizör",
    "Yönetici",
  ];
  const yoneticiMi = YONETICILER.includes(aktifKullanici?.rol);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  useEffect(() => {
    veriCek();
  }, []);

  useEffect(() => {
    if (acilacakGorevId && gorevler.length > 0) {
      const hedef = gorevler.find((g) => g.id === acilacakGorevId);
      if (hedef) detayAc(hedef);
    }
  }, [acilacakGorevId, gorevler]);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/gorevler`)
      .then((res) => res.json())
      .then((data) => {
        setGorevler(Array.isArray(data) ? data : []);
        setYukleniyor(false);
      })
      .catch(() => {
        setGorevler([]);
        setYukleniyor(false);
      });
  };

  const filtrelenmisGorevler = gorevler.filter((gorev) => {
    const metinUyumu =
      (gorev.baslik || "").toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (gorev.aciklama || "").toLowerCase().includes(aramaMetni.toLowerCase());

    const durumUyumu = filtreDurum ? gorev.durum === filtreDurum : true;
    const oncelikUyumu = filtreOncelik ? gorev.oncelik === filtreOncelik : true;
    const benimIsimMi = sadeceBenim
      ? gorev.atananlar?.includes(aktifKullanici.ad_soyad)
      : true;
    return metinUyumu && durumUyumu && oncelikUyumu && benimIsimMi;
  });

  const formGonder = (degerler) => {
    const fd = new FormData();
    fd.append("olusturan_id", aktifKullanici.id);
    fd.append("baslik", degerler.baslik);
    fd.append("aciklama", degerler.aciklama || "");
    fd.append("oncelik", degerler.oncelik || "Orta");
    fd.append("tekrar_tipi", degerler.tekrar_tipi || "Tek Seferlik");
    if (degerler.proje_id) fd.append("proje_id", degerler.proje_id);
    if (degerler.tarih) fd.append("tarih", degerler.tarih.format("YYYY-MM-DD"));
    fd.append("atananlar", JSON.stringify(degerler.atananlar || []));
    fd.append("gozlemciler", JSON.stringify(degerler.gozlemciler || []));
    if (degerler.dosya && degerler.dosya.length > 0) {
      degerler.dosya.forEach((fileItem) => {
        fd.append("dosyalar", fileItem.originFileObj);
      });
    }

    fetch(`${API_URL}/gorevler`, { method: "POST", body: fd })
      .then((res) => res.json())
      .then((yeni) => {
        setGorevler([...gorevler, yeni]);
        message.success("Görev oluşturuldu");
        setModalAcik(false);
        form.resetFields();
      });
  };

  const gorevGuncelle = async (v) => {
    setFormYukleniyor(true);
    const fd = new FormData();
    fd.append("baslik", v.baslik || seciliGorev.baslik);
    fd.append("aciklama", v.aciklama || "");
    fd.append("oncelik", v.oncelik || seciliGorev.oncelik);
    fd.append("durum", seciliGorev.durum);
    fd.append("olusturan_id", aktifKullanici.id);

    if (v.proje_id !== undefined) fd.append("proje_id", v.proje_id || "");
    else if (seciliGorev.proje_id) fd.append("proje_id", seciliGorev.proje_id);

    if (v.tarih) fd.append("tarih", v.tarih.format("YYYY-MM-DD"));
    else if (seciliGorev.tarih)
      fd.append("tarih", dayjs(seciliGorev.tarih).format("YYYY-MM-DD"));

    const atananlarFinal =
      v.atananlar !== undefined ? v.atananlar : seciliGorev.atananlar || [];
    fd.append("atananlar", JSON.stringify(atananlarFinal));

    if (v.dosya && v.dosya.length > 0) {
      v.dosya.forEach((fileItem) => {
        fd.append("dosyalar", fileItem.originFileObj);
      });
    }

    try {
      const res = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`, {
        method: "PUT",
        body: fd,
      });
      if (!res.ok) throw new Error("Hata");
      const guncel = await res.json();
      setGorevler((prev) =>
        prev.map((g) => (g.id === seciliGorev.id ? { ...g, ...guncel } : g))
      );
      setSeciliGorev({ ...seciliGorev, ...guncel });

      const detayRes = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`);
      const detayData = await detayRes.json();
      setSeciliGorevDosyalari(detayData.dosyalar || []);

      setDuzenlemeModu(false);
      message.success("Güncellendi");
    } catch (e) {
      message.error("Hata");
    } finally {
      setFormYukleniyor(false);
    }
  };

  const handleEditClick = async () => {
    try {
      const values = await detayForm.validateFields();
      gorevGuncelle(values);
    } catch (errorInfo) {
      message.error("Lütfen zorunlu alanları kontrol edin.");
    }
  };

  const durumDegistir = (id, d) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: d }),
    }).then(() => {
      setGorevler((prev) =>
        prev.map((g) => (g.id === id ? { ...g, durum: d } : g))
      );
      if (seciliGorev?.id === id)
        setSeciliGorev((prev) => ({ ...prev, durum: d }));
      message.success("Durum güncellendi");
    });
  };

  const sil = (id) => {
    fetch(`${API_URL}/gorevler/${id}`, { method: "DELETE" }).then(() => {
      veriCek();
      message.success("Silindi");
    });
  };

  const detayAc = async (kayit) => {
    setSeciliGorev(kayit);
    setDetayModalAcik(true);
    setDuzenlemeModu(false);

    detayForm.resetFields();
    detayForm.setFieldsValue({
      ...kayit,
      tarih: kayit.tarih ? dayjs(kayit.tarih) : null,
      atananlar: kayit.atananlar || [],
      proje_id: kayit.proje_id,
    });

    try {
      const res = await fetch(`${API_URL}/gorevler/${kayit.id}`);
      const data = await res.json();
      setSeciliGorevDosyalari(data.dosyalar || []);
    } catch (e) {
      setSeciliGorevDosyalari([]);
    }

    fetch(`${API_URL}/gorevler/${kayit.id}/yorumlar`)
      .then((r) => r.json())
      .then(setYorumlar);
    fetch(`${API_URL}/gorevler/${kayit.id}/alt-gorevler`)
      .then((r) => r.json())
      .then(setAltGorevler);
  };

  const altGorevEkle = () => {
    if (!yeniAltGorev) return;
    fetch(`${API_URL}/gorevler/${seciliGorev.id}/alt-gorevler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baslik: yeniAltGorev,
        olusturan_id: aktifKullanici.id,
      }),
    })
      .then((r) => r.json())
      .then((y) => {
        setAltGorevler([...altGorevler, y]);
        setYeniAltGorev("");
      });
  };

  const altGorevToggle = (id, d) => {
    fetch(`${API_URL}/alt-gorevler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: !d }),
    }).then(() => {
      setAltGorevler(
        altGorevler.map((a) => (a.id === id ? { ...a, durum: !d } : a))
      );
    });
  };

  const altGorevSil = (id) => {
    fetch(`${API_URL}/alt-gorevler/${id}`, { method: "DELETE" }).then(() =>
      setAltGorevler(altGorevler.filter((a) => a.id !== id))
    );
  };

  const yorumGonder = () => {
    if (!yeniYorum) return;
    fetch(`${API_URL}/gorevler/${seciliGorev.id}/yorumlar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yazan_kisi_id: aktifKullanici.id,
        mesaj: yeniYorum,
      }),
    })
      .then((r) => r.json())
      .then((y) => {
        const yeniYorumObj = {
          ...y,
          yazan_kisi_adi: aktifKullanici.ad_soyad,
          yazan_kisi_avatar: aktifKullanici.avatar,
        };
        setYorumlar([...yorumlar, yeniYorumObj]);
        setYeniYorum("");
      });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const gorevId = parseInt(active.id);
    const yeniDurum = over.id;
    if (gorevler.find((g) => g.id === gorevId)?.durum !== yeniDurum)
      durumDegistir(gorevId, yeniDurum);
  };

  const takvimGunTikla = (value) => {
    const t = value.format("YYYY-MM-DD");
    const i = gorevler.filter((g) => g.tarih && g.tarih.startsWith(t));
    if (i.length > 0) {
      setSeciliTarih(value.format("DD MMMM YYYY"));
      setSeciliGunIsleri(i);
      setTakvimGunModal(true);
    }
  };

  const takvimCellRender = (value) => {
    const t = value.format("YYYY-MM-DD");
    const l = gorevler.filter((g) => g.tarih && g.tarih.startsWith(t));
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {l.map((i) => (
          <li key={i.id} style={{ marginBottom: 3 }}>
            <Badge
              status={i.durum === "Yapıldı" ? "success" : "warning"}
              text={
                <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                  #{i.id} - {i.baslik}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  const columns = [
    {
      title: "Proje",
      dataIndex: "proje_adi",
      width: 150,
      render: (ad) =>
        ad ? <Tag color="geekblue">{ad}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => (
        <a onClick={() => detayAc(r)} style={{ fontWeight: 600 }}>
          #{r.id} - {t}
        </a>
      ),
    },
    {
      title: "Sorumlular",
      dataIndex: "atananlar",
      width: 120,
      render: (kisiler) => (
        <Avatar.Group max={{ count: 3 }} size="small">
          {kisiler?.map((k, i) => (
            <Tooltip title={k} key={i}>
              {getUserAvatar(k, kullanicilar || [])}
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: "Bitiş",
      dataIndex: "tarih",
      width: 130,
      sorter: (a, b) => dayjs(a.tarih).unix() - dayjs(b.tarih).unix(),
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
          onClick={() => detayAc(r)}
        />
      ),
    },
  ];

  return (
    <div>
      {viewMode !== "calendar" && (
        <Card
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: "12px 20px" } }} // bodyStyle deprecation fix
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Space wrap>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ara..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                <Select
                  placeholder="Durum"
                  style={{ width: 130 }}
                  allowClear
                  onChange={setFiltreDurum}
                  value={filtreDurum}
                >
                  <Option value="Bekliyor">Bekliyor</Option>
                  <Option value="Onay Bekliyor">Onay Bekliyor</Option>
                  <Option value="Yapıldı">Yapıldı</Option>
                </Select>
                <Select
                  placeholder="Öncelik"
                  style={{ width: 120 }}
                  allowClear
                  onChange={setFiltreOncelik}
                  value={filtreOncelik}
                >
                  <Option value="Yüksek">Yüksek</Option>
                  <Option value="Orta">Orta</Option>
                </Select>
                <Checkbox
                  checked={sadeceBenim}
                  onChange={(e) => setSadeceBenim(e.target.checked)}
                >
                  Sadece Benim İşlerim
                </Checkbox>
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => {
                    setAramaMetni("");
                    setFiltreDurum(null);
                    setFiltreOncelik(null);
                    setSadeceBenim(false);
                  }}
                >
                  Temizle
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                {yoneticiMi && (
                  <Button icon={<FolderAddOutlined />} onClick={projeModalAc}>
                    Projeler
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModalAcik(true)}
                >
                  Yeni İş
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {viewMode === "list" && (
        <Table
          columns={columns}
          dataSource={filtrelenmisGorevler}
          rowKey="id"
          loading={yukleniyor}
          pagination={{ pageSize: 10 }}
        />
      )}

      {viewMode === "board" && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <Row gutter={16}>
            <Col span={8}>
              <KanbanColumn id="Bekliyor" title="YAPILACAKLAR" color="blue">
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Bekliyor")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                      allUsers={kullanicilar || []}
                    />
                  ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn
                id="Onay Bekliyor"
                title="ONAY / İŞLEMDE"
                color="gold"
              >
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Onay Bekliyor")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                      allUsers={kullanicilar || []}
                    />
                  ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn id="Yapıldı" title="TAMAMLANANLAR" color="green">
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Yapıldı")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                      allUsers={kullanicilar || []}
                    />
                  ))}
              </KanbanColumn>
            </Col>
          </Row>
        </DndContext>
      )}

      {viewMode === "calendar" && (
        <Calendar
          locale={locale}
          onSelect={takvimGunTikla}
          cellRender={takvimCellRender}
        />
      )}

      <Modal
        title="Yeni İş Emri"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          onFinish={formGonder}
          layout="vertical"
          initialValues={{
            oncelik: "Orta",
            atananlar: [aktifKullanici.ad_soyad],
            tekrar_tipi: "Tek Seferlik",
          }}
        >
          <Form.Item name="proje_id" label="Bağlı Olduğu Proje">
            <Select
              allowClear
              placeholder="Seçiniz"
              showSearch
              optionFilterProp="children"
            >
              {projeler && projeler.length > 0 ? (
                projeler.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.ad} ({p.departman})
                  </Option>
                ))
              ) : (
                <Option disabled>Henüz proje yok</Option>
              )}
            </Select>
          </Form.Item>
          <Form.Item name="baslik" label="Başlık" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="atananlar" label="Sorumlular">
                <Select mode="multiple" allowClear>
                  {kullanicilar?.map((k) => (
                    <Option key={k.id} value={k.ad_soyad}>
                      {k.ad_soyad}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tarih" label="Bitiş Tarihi">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="oncelik" label="Öncelik">
                <Select>
                  <Option value="Yüksek">Yüksek</Option>
                  <Option value="Orta">Orta</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dosya"
                label="Ek Dosya (Çoklu Seçilebilir)"
                valuePropName="fileList"
                getValueFromEvent={(e) =>
                  Array.isArray(e) ? e : e && e.fileList
                }
              >
                <Upload beforeUpload={() => false} maxCount={10} multiple>
                  <Button icon={<UploadOutlined />}>Dosyaları Seç</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" block size="large">
            Kaydet
          </Button>
        </Form>
      </Modal>

      {/* DETAY MODALI */}
      <Modal
        open={detayModalAcik}
        onCancel={() => setDetayModalAcik(false)}
        footer={null}
        width={900}
        centered
        title={`Görev Detayı #${seciliGorev?.id}`}
      >
        {seciliGorev && (
          <Row gutter={24}>
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <Form
                form={detayForm}
                layout="vertical"
                initialValues={seciliGorev}
              >
                <div
                  style={{
                    marginBottom: 15,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Tag color="geekblue">
                    {seciliGorev.proje_adi || "Genel Görev"}
                  </Tag>
                  <span style={{ marginLeft: 10, fontWeight: 600 }}>
                    #{seciliGorev.id}
                  </span>
                  <Space>
                    <Button
                      onClick={() => setDuzenlemeModu(!duzenlemeModu)}
                      icon={duzenlemeModu ? <SaveOutlined /> : <EditOutlined />}
                    >
                      {duzenlemeModu ? "İptal" : "Düzenle"}
                    </Button>
                    <Popconfirm
                      title="Sil?"
                      onConfirm={() => {
                        sil(seciliGorev.id);
                        setDetayModalAcik(false);
                      }}
                    >
                      <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
                <Form.Item name="baslik" label="Başlık">
                  <Input
                    style={{ fontWeight: "bold" }}
                    disabled={!duzenlemeModu}
                  />
                </Form.Item>
                <Form.Item name="aciklama" label="Açıklama">
                  <Input.TextArea rows={3} disabled={!duzenlemeModu} />
                </Form.Item>
                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item name="atananlar" label="Sorumlular">
                      <Select mode="multiple" disabled={!duzenlemeModu}>
                        {kullanicilar?.map((k) => (
                          <Option key={k.id} value={k.ad_soyad}>
                            {k.ad_soyad}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tarih" label="Bitiş">
                      <DatePicker
                        style={{ width: "100%" }}
                        disabled={!duzenlemeModu}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {duzenlemeModu && (
                  <>
                    <Form.Item
                      name="dosya"
                      label="Dosya Ekle"
                      valuePropName="fileList"
                      getValueFromEvent={(e) =>
                        Array.isArray(e) ? e : e && e.fileList
                      }
                    >
                      <Upload maxCount={5} multiple beforeUpload={() => false}>
                        <Button icon={<UploadOutlined />}>Yeni Dosya</Button>
                      </Upload>
                    </Form.Item>
                    <Button type="primary" block onClick={handleEditClick}>
                      Değişiklikleri Kaydet
                    </Button>
                  </>
                )}
              </Form>

              <div style={{ marginTop: 20 }}>
                <Title level={5}>Ekli Dosyalar</Title>
                {seciliGorevDosyalari.length > 0 ? (
                  <List
                    size="small"
                    dataSource={seciliGorevDosyalari}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <a
                            href={`${API_URL}/uploads/${file.fiziksel_ad}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            İndir/Görüntüle
                          </a>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={getFileIcon(file.ad)}
                          title={file.ad}
                          description={
                            <span style={{ fontSize: 10 }}>
                              {dayjs(file.tarih).format("DD.MM.YYYY HH:mm")}
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{ color: "#999", fontStyle: "italic" }}>
                    Bu görevde dosya yok.
                  </div>
                )}
              </div>

              <Divider style={{ margin: "15px 0" }} />
              <Title level={5}>Alt Görevler</Title>
              <List
                size="small"
                dataSource={altGorevler}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => altGorevSil(item.id)}
                      />,
                    ]}
                  >
                    <Checkbox
                      checked={item.durum}
                      onChange={() => altGorevToggle(item.id, item.durum)}
                      style={{
                        textDecoration: item.durum ? "line-through" : "none",
                      }}
                    >
                      {item.baslik}
                    </Checkbox>
                  </List.Item>
                )}
              />
              <Space.Compact style={{ width: "100%", marginTop: 10 }}>
                <Input
                  placeholder="Alt görev..."
                  value={yeniAltGorev}
                  onChange={(e) => setYeniAltGorev(e.target.value)}
                  onPressEnter={altGorevEkle}
                />
                <Button type="primary" onClick={altGorevEkle}>
                  Ekle
                </Button>
              </Space.Compact>
            </Col>
            <Col span={10}>
              <Title level={5}>
                <MessageOutlined /> Sohbet
              </Title>
              <div
                style={{
                  height: 400,
                  overflowY: "auto",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <List
                  dataSource={yorumlar}
                  renderItem={(item) => (
                    <List.Item style={{ padding: "8px 0" }}>
                      <List.Item.Meta
                        avatar={
                          item.yazan_kisi_avatar ? (
                            <Avatar
                              src={`${API_URL}/uploads/${item.yazan_kisi_avatar}`}
                            />
                          ) : (
                            <Avatar style={{ backgroundColor: "#1890ff" }}>
                              {
                                (item.yazan_kisi_adi ||
                                  item.yazan_kisi ||
                                  "?")[0]
                              }
                            </Avatar>
                          )
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text strong>
                              {item.yazan_kisi_adi || item.yazan_kisi || "?"}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              {dayjs(item.tarih).format("DD.MM HH:mm")}
                            </Text>
                          </div>
                        }
                        description={item.mesaj}
                      />
                    </List.Item>
                  )}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Mentions
                  rows={2}
                  placeholder="@..."
                  value={yeniYorum}
                  onChange={setYeniYorum}
                  options={kullanicilar?.map((k) => ({
                    value: k.ad_soyad,
                    label: k.ad_soyad,
                  }))}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ marginTop: 5, float: "right" }}
                  onClick={yorumGonder}
                >
                  Gönder
                </Button>
              </div>
            </Col>
          </Row>
        )}
      </Modal>

      <Drawer
        title={seciliTarih}
        placement="right"
        onClose={() => setTakvimGunModal(false)}
        open={takvimGunModal}
        // width prop kaldırıldı -> Drawer width deprecation fix
      >
        <List
          dataSource={seciliGunIsleri}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  size="small"
                  onClick={() => {
                    setTakvimGunModal(false);
                    detayAc(item);
                  }}
                >
                  Detay
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={`#${item.id} - ${item.baslik}`}
                description={
                  <Tag color={item.durum === "Yapıldı" ? "green" : "blue"}>
                    {item.durum}
                  </Tag>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
