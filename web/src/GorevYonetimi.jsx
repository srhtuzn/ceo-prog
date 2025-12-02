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
  Progress,
  List,
  Checkbox,
  Avatar,
  Mentions,
  Calendar,
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
} from "@ant-design/icons";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

// --- KANBAN BİLEŞENLERİ ---
const KanbanCard = ({ gorev, onClick }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: gorev.id.toString(),
    data: { gorev },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: 0.8,
        cursor: "grabbing",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 10 }}
      {...listeners}
      {...attributes}
    >
      <div
        style={{
          background: "white",
          padding: 12,
          borderRadius: 6,
          cursor: "grab",
          borderLeft: `4px solid ${
            gorev.oncelik === "Yüksek"
              ? "#ff4d4f"
              : gorev.oncelik === "Orta"
              ? "#faad14"
              : "#1890ff"
          }`,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
        onClick={onClick}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <Text strong style={{ fontSize: 13 }} ellipsis>
            {gorev.baslik}
          </Text>
          {gorev.dosya_yolu && (
            <PaperClipOutlined style={{ color: "#1890ff", fontSize: 12 }} />
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space size={2}>
            {gorev.atananlar?.slice(0, 3).map((k, i) => (
              <Avatar
                key={i}
                size={20}
                style={{ backgroundColor: "#87d068", fontSize: 10 }}
              >
                {k[0]}
              </Avatar>
            ))}
          </Space>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {gorev.tarih ? dayjs(gorev.tarih).format("DD.MM") : ""}
          </Text>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ id, title, color, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: id });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "#e6f7ff" : "#f5f5f5",
        padding: 12,
        borderRadius: 8,
        minHeight: "calc(100vh - 220px)",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          marginBottom: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          strong
          style={{ textTransform: "uppercase", fontSize: 12, color: "#666" }}
        >
          {title}
        </Text>
        <Tag color={color}>{children.length}</Tag>
      </div>
      {children}
    </div>
  );
};

// --- ANA BİLEŞEN ---
export default function GorevYonetimi({
  aktifKullanici,
  projeler,
  kullanicilar,
  bildirimler,
  acilacakGorevId,
  viewMode,
}) {
  const [gorevler, setGorevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [formYukleniyor, setFormYukleniyor] = useState(false);

  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDurum, setFiltreDurum] = useState(null);
  const [filtreOncelik, setFiltreOncelik] = useState(null);

  const [modalAcik, setModalAcik] = useState(false);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);

  const [seciliGorev, setSeciliGorev] = useState(null);
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
        if (Array.isArray(data)) setGorevler(data);
        else setGorevler([]);
        setYukleniyor(false);
      })
      .catch(() => {
        setGorevler([]);
        setYukleniyor(false);
      });
  };

  const guvenliIslem = (callback) => {
    if (seciliGorev && seciliGorev.durum === "Yapıldı") {
      Modal.confirm({
        title: "Dikkat!",
        content: (
          <div>
            <p>
              Bu görev daha önce <b>tamamlanmıştır.</b>
            </p>
            <p>
              Değişiklik yaparsanız görev durumu tekrar <b>'Bekliyor'</b> olarak
              güncellenecektir.
            </p>
            <p>Devam etmek istiyor musunuz?</p>
          </div>
        ),
        okText: "Evet, Güncelle",
        cancelText: "İptal",
        onOk: () => {
          durumDegistir(seciliGorev.id, "Bekliyor");
          setSeciliGorev({ ...seciliGorev, durum: "Bekliyor" });
          callback();
        },
      });
    } else {
      callback();
    }
  };

  const formGonder = (degerler) => {
    const formData = new FormData();
    formData.append("baslik", degerler.baslik);
    formData.append("aciklama", degerler.aciklama || "");
    formData.append("oncelik", degerler.oncelik || "Orta");
    formData.append("tekrar_tipi", degerler.tekrar_tipi || "Tek Seferlik");

    if (degerler.proje_id) formData.append("proje_id", degerler.proje_id);

    if (degerler.tarih) {
      formData.append("tarih", degerler.tarih.format("YYYY-MM-DD"));
    }

    formData.append("atananlar", JSON.stringify(degerler.atananlar || []));
    formData.append("gozlemciler", JSON.stringify(degerler.gozlemciler || []));

    if (degerler.dosya && degerler.dosya.length > 0) {
      formData.append("dosya", degerler.dosya[0].originFileObj);
    }

    fetch(`${API_URL}/gorevler`, { method: "POST", body: formData })
      .then((res) => res.json())
      .then((yeni) => {
        setGorevler([...gorevler, yeni]);
        message.success("Kayıt Başarılı!");
        setModalAcik(false);
        form.resetFields();
      });
  };

  const gorevGuncelle = async (degerler) => {
    try {
      setFormYukleniyor(true);
      const formData = new FormData();
      formData.append("baslik", degerler.baslik || seciliGorev.baslik);
      formData.append("aciklama", degerler.aciklama || "");
      formData.append("oncelik", degerler.oncelik || "Orta");
      formData.append("durum", seciliGorev.durum);

      if (degerler.proje_id) formData.append("proje_id", degerler.proje_id);
      if (degerler.tarih) {
        formData.append("tarih", degerler.tarih.format("YYYY-MM-DD"));
      }

      formData.append("atananlar", JSON.stringify(degerler.atananlar || []));

      if (degerler.dosya && degerler.dosya.length > 0) {
        formData.append("dosya", degerler.dosya[0].originFileObj);
      }

      const response = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) throw new Error("Güncelleme başarısız");

      const guncelGorev = await response.json();

      setGorevler((prev) =>
        prev.map((g) =>
          g.id === seciliGorev.id ? { ...g, ...guncelGorev } : g
        )
      );
      setSeciliGorev({ ...seciliGorev, ...guncelGorev });

      setDuzenlemeModu(false);
      message.success("Görev başarıyla güncellendi!");
    } catch (err) {
      message.error("Güncelleme hatası: " + err.message);
    } finally {
      setFormYukleniyor(false);
    }
  };

  const durumDegistir = (id, yeniDurum) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: yeniDurum }),
    }).then(() => {
      setGorevler((prev) =>
        prev.map((g) => (g.id === id ? { ...g, durum: yeniDurum } : g))
      );
      if (seciliGorev && seciliGorev.id === id)
        setSeciliGorev((prev) => ({ ...prev, durum: yeniDurum }));
      message.success(`Durum güncellendi: ${yeniDurum}`);
    });
  };

  const sil = (id) => {
    fetch(`${API_URL}/gorevler/${id}`, { method: "DELETE" }).then(() => {
      veriCek();
      message.success("Silindi");
    });
  };

  const detayAc = (kayit) => {
    setSeciliGorev(kayit);
    setDetayModalAcik(true);
    setDuzenlemeModu(false);

    detayForm.setFieldsValue({
      ...kayit,
      tarih: kayit.tarih ? dayjs(kayit.tarih) : null,
      atananlar: Array.isArray(kayit.atananlar) ? kayit.atananlar : [],
      proje_id: kayit.proje_id,
    });

    fetch(`${API_URL}/gorevler/${kayit.id}/yorumlar`)
      .then((res) => res.json())
      .then((data) => setYorumlar(data));
    fetch(`${API_URL}/gorevler/${kayit.id}/alt-gorevler`)
      .then((res) => res.json())
      .then((data) => setAltGorevler(data));
  };

  const altGorevEkle = () => {
    if (!yeniAltGorev) return;
    guvenliIslem(() => {
      fetch(`${API_URL}/gorevler/${seciliGorev.id}/alt-gorevler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baslik: yeniAltGorev,
          olusturan: aktifKullanici.ad_soyad,
        }),
      })
        .then((res) => res.json())
        .then((yeni) => {
          setAltGorevler([...altGorevler, yeni]);
          setYeniAltGorev("");
          message.success("Alt adım eklendi");
        });
    });
  };

  const altGorevToggle = (id, mevcutDurum) => {
    guvenliIslem(() => {
      const yeniDurum = !mevcutDurum;
      fetch(`${API_URL}/gorevler/alt-gorevler/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durum: yeniDurum }),
      }).then(() => {
        setAltGorevler(
          altGorevler.map((ag) =>
            ag.id === id ? { ...ag, durum: yeniDurum } : ag
          )
        );
      });
    });
  };

  const altGorevSil = (id) => {
    guvenliIslem(() => {
      fetch(`${API_URL}/gorevler/alt-gorevler/${id}`, {
        method: "DELETE",
      }).then(() => setAltGorevler(altGorevler.filter((ag) => ag.id !== id)));
    });
  };

  const yorumGonder = () => {
    if (!yeniYorum) return;
    guvenliIslem(() => {
      fetch(`${API_URL}/gorevler/${seciliGorev.id}/yorumlar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yazan_kisi: aktifKullanici.ad_soyad,
          mesaj: yeniYorum,
        }),
      })
        .then((res) => res.json())
        .then((yeni) => {
          setYorumlar([...yorumlar, yeni]);
          setYeniYorum("");
        });
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const gorevId = parseInt(active.id);
    const yeniDurum = over.id;

    const gorev = gorevler.find((g) => g.id === gorevId);
    if (!gorev || gorev.durum === yeniDurum) return;

    if (gorev.durum === "Yapıldı") {
      Modal.confirm({
        title: "Dikkat! Tamamlanmış Görev",
        content:
          "Bu görev daha önce tamamlanmıştır. Durumunu değiştirmek istediğinize emin misiniz?",
        okText: "Evet, Değiştir",
        cancelText: "İptal",
        onOk: () => durumDegistir(gorevId, yeniDurum),
      });
    } else {
      durumDegistir(gorevId, yeniDurum);
    }
  };

  const takvimCellRender = (value, info) => {
    if (info.type !== "date") return info.originNode;
    const tarihString = value.format("YYYY-MM-DD");
    const bugunkuIsler = gorevler.filter(
      (g) => g.tarih && g.tarih.startsWith(tarihString)
    );
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {bugunkuIsler.map((item) => (
          <li key={item.id}>
            <Badge
              status={
                item.oncelik === "Yüksek"
                  ? "error"
                  : item.durum === "Yapıldı"
                  ? "success"
                  : "processing"
              }
              text={item.baslik}
              style={{ fontSize: "10px" }}
            />
          </li>
        ))}
      </ul>
    );
  };

  const filtrelenmisGorevler = gorevler.filter((gorev) => {
    const metinUyumu =
      gorev.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (gorev.aciklama &&
        gorev.aciklama.toLowerCase().includes(aramaMetni.toLowerCase()));
    const durumUyumu = filtreDurum ? gorev.durum === filtreDurum : true;
    const oncelikUyumu = filtreOncelik ? gorev.oncelik === filtreOncelik : true;
    return metinUyumu && durumUyumu && oncelikUyumu;
  });

  const columns = [
    {
      title: "Proje",
      dataIndex: "proje_adi",
      render: (ad) =>
        ad ? <Tag color="cyan">{ad}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => {
        const okunmamisVar =
          bildirimler &&
          bildirimler.some((b) => b.gorev_id === r.id && !b.okundu);
        return (
          <Badge dot={okunmamisVar} offset={[5, 0]}>
            <a
              onClick={() => detayAc(r)}
              style={{ fontWeight: "bold", color: "#1890ff" }}
            >
              {t}
            </a>
          </Badge>
        );
      },
    },
    {
      title: "Rolüm",
      key: "rolum",
      width: 100,
      render: (_, r) => {
        const sorumluMu = r.atananlar?.includes(aktifKullanici.ad_soyad);
        const gozlemciMi = r.gozlemciler?.includes(aktifKullanici.ad_soyad);
        if (sorumluMu) return <Tag color="blue">Sorumlu</Tag>;
        if (gozlemciMi) return <Tag color="gold">Gözlemci</Tag>;
        if (yoneticiMi) return <Tag color="purple">Yönetici</Tag>;
        return <Tag> - </Tag>;
      },
    },
    {
      title: "Durum",
      dataIndex: "durum",
      render: (d) => (
        <Tag
          color={
            d === "Yapıldı" ? "green" : d === "Onay Bekliyor" ? "gold" : "blue"
          }
        >
          {d}
        </Tag>
      ),
    },
    {
      title: "Öncelik",
      dataIndex: "oncelik",
      render: (o) => <Tag color={o === "Yüksek" ? "red" : "blue"}>{o}</Tag>,
    },
    {
      title: "Ek",
      dataIndex: "dosya_yolu",
      align: "center",
      render: (yol) =>
        yol ? (
          <PaperClipOutlined style={{ color: "#1890ff", fontSize: 18 }} />
        ) : (
          <span>-</span>
        ),
    },
    {
      title: "İşlem",
      width: 200,
      render: (_, r) => {
        const sorumluMu = r.atananlar?.includes(aktifKullanici.ad_soyad);
        return (
          <Space key={`islem-${r.id}`}>
            {r.durum === "Bekliyor" &&
              (sorumluMu ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => durumDegistir(r.id, "Onay Bekliyor")}
                >
                  Tamamla
                </Button>
              ) : (
                !yoneticiMi && (
                  <span style={{ color: "#999", fontSize: 11 }}>
                    İzleme Yetkisi
                  </span>
                )
              ))}
            {r.durum === "Onay Bekliyor" && (
              <>
                {yoneticiMi ? (
                  <>
                    <Button
                      type="primary"
                      style={{
                        backgroundColor: "#52c41a",
                        borderColor: "#52c41a",
                      }}
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => durumDegistir(r.id, "Yapıldı")}
                    >
                      Onayla
                    </Button>
                    <Button
                      danger
                      size="small"
                      onClick={() => durumDegistir(r.id, "Bekliyor")}
                    >
                      Reddet
                    </Button>
                  </>
                ) : (
                  <span style={{ color: "#999", fontSize: 11 }}>
                    Yönetici Onayı Bekleniyor
                  </span>
                )}
              </>
            )}
            {r.durum === "Yapıldı" && yoneticiMi && (
              <Button
                type="default"
                size="small"
                onClick={() => durumDegistir(r.id, "Bekliyor")}
              >
                Geri Al
              </Button>
            )}
            {yoneticiMi && (
              <Popconfirm title="Sil?" onConfirm={() => sil(r.id)}>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const kanbanData = {
    Bekliyor: filtrelenmisGorevler.filter((g) => g.durum === "Bekliyor"),
    "Onay Bekliyor": filtrelenmisGorevler.filter(
      (g) => g.durum === "Onay Bekliyor"
    ),
    Yapıldı: filtrelenmisGorevler.filter((g) => g.durum === "Yapıldı"),
  };

  return (
    <div>
      {/* ÜST ARAÇ ÇUBUĞU */}
      {viewMode !== "calendar" && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space wrap>
            <Input
              placeholder="Ara..."
              prefix={<SearchOutlined style={{ color: "#ccc" }} />}
              style={{ width: 200 }}
              value={aramaMetni}
              onChange={(e) => setAramaMetni(e.target.value)}
              allowClear
            />
            <Select
              placeholder="Durum"
              style={{ width: 120 }}
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
            {(aramaMetni || filtreDurum || filtreOncelik) && (
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setAramaMetni("");
                  setFiltreDurum(null);
                  setFiltreOncelik(null);
                }}
              >
                Temizle
              </Button>
            )}
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalAcik(true)}
          >
            Yeni İş
          </Button>
        </div>
      )}

      {/* --- 1. LİSTE GÖRÜNÜMÜ --- */}
      {viewMode === "list" && (
        <Table
          columns={columns}
          dataSource={filtrelenmisGorevler}
          rowKey="id"
          loading={yukleniyor}
          pagination={{ pageSize: 10 }}
        />
      )}

      {/* --- 2. PANO (KANBAN) GÖRÜNÜMÜ --- */}
      {viewMode === "board" && (
        <DndContext onDragEnd={handleDragEnd}>
          <Row gutter={16} style={{ height: "100%" }}>
            <Col span={8}>
              <KanbanColumn id="Bekliyor" title="YAPILACAKLAR" color="blue">
                {kanbanData["Bekliyor"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn
                id="Onay Bekliyor"
                title="ONAY / İŞLEMDE"
                color="gold"
              >
                {kanbanData["Onay Bekliyor"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn id="Yapıldı" title="TAMAMLANANLAR" color="green">
                {kanbanData["Yapıldı"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
          </Row>
        </DndContext>
      )}

      {/* --- 3. TAKVİM GÖRÜNÜMÜ --- */}
      {viewMode === "calendar" && <Calendar cellRender={takvimCellRender} />}

      {/* --- YENİ İŞ EKLEME MODALI --- */}
      <Modal
        title="Yeni İş Emri Oluştur"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
        destroyOnClose={true}
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
            <Select placeholder="Bir proje seçin (Opsiyonel)" allowClear>
              {projeler &&
                projeler.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.ad} ({p.departman})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="baslik" label="Başlık" rules={[{ required: true }]}>
            <Input placeholder="Örn: Sunucu Güncellemesi" />
          </Form.Item>
          <Form.Item name="atananlar" label="Sorumlu Personel">
            <Select
              mode="multiple"
              placeholder="Kişi seçin"
              allowClear
              disabled={aktifKullanici.rol === "Personel"}
            >
              {kullanicilar &&
                kullanicilar.map((k) => (
                  <Option key={k.id} value={k.ad_soyad}>
                    {k.ad_soyad}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="gozlemciler" label="Gözlemciler (Bilgi Sahibi)">
            <Select mode="multiple" placeholder="Kişi seçin">
              {kullanicilar &&
                kullanicilar.map((k) => (
                  <Option key={k.id} value={k.ad_soyad}>
                    {k.ad_soyad}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <div style={{ display: "flex", gap: 10 }}>
            <Form.Item name="oncelik" label="Öncelik" style={{ flex: 1 }}>
              <Select>
                <Option value="Orta">Orta</Option>
                <Option value="Yüksek">Yüksek</Option>
              </Select>
            </Form.Item>
            <Form.Item name="tarih" label="Bitiş Tarihi" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="tekrar_tipi"
              label="Tekrar Durumu"
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="Tek Seferlik">Tek Seferlik</Option>
                <Option value="Günlük">Günlük</Option>
                <Option value="Haftalık">Haftalık</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="dosyalar"
            label="Ek Dosyalar"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e && e.fileList)}
          >
            <Upload
              beforeUpload={() => false}
              listType="picture"
              multiple={true}
              maxCount={10}
            >
              <Button icon={<UploadOutlined />}>Dosyaları Seç (Çoklu)</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Kaydet
          </Button>
        </Form>
      </Modal>

      {/* --- DETAY MODALI --- */}
      <Modal
        open={detayModalAcik}
        onCancel={() => setDetayModalAcik(false)}
        footer={null}
        width={900}
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingRight: 30,
            }}
          >
            {duzenlemeModu ? (
              <Input defaultValue={seciliGorev?.baslik} onChange={(e) => {}} />
            ) : (
              <span style={{ fontSize: 18 }}>{seciliGorev?.baslik}</span>
            )}
            <Space>
              <Button
                type={duzenlemeModu ? "primary" : "default"}
                icon={duzenlemeModu ? <SaveOutlined /> : <EditOutlined />}
                onClick={() => setDuzenlemeModu(!duzenlemeModu)}
              >
                {duzenlemeModu ? "Vazgeç" : "Düzenle"}
              </Button>
              <Tag color={seciliGorev?.durum === "Yapıldı" ? "green" : "blue"}>
                {seciliGorev?.durum}
              </Tag>
            </Space>
          </div>
        }
      >
        {seciliGorev && (
          <Row gutter={24}>
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <Form
                form={detayForm}
                layout="vertical"
                initialValues={seciliGorev}
                disabled={!duzenlemeModu}
              >
                <div style={{ marginBottom: 20 }}>
                  <Text type="secondary">
                    <ProjectOutlined /> Proje:
                  </Text>{" "}
                  <strong style={{ color: "#1890ff" }}>
                    {seciliGorev.proje_adi || "Genel"}
                  </strong>
                  <Divider type="vertical" />
                  <Form.Item
                    name="tekrar_tipi"
                    label="Tekrar"
                    style={{ display: "inline-block", margin: 0, width: 150 }}
                  >
                    <Select size="small">
                      <Option value="Tek Seferlik">Tek Seferlik</Option>
                      <Option value="Günlük">Günlük</Option>
                    </Select>
                  </Form.Item>
                </div>

                <Form.Item name="aciklama" label="Açıklama">
                  <Input.TextArea rows={3} />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="atananlar" label="Sorumlu">
                      <Select mode="multiple">
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

                {duzenlemeModu && (
                  <>
                    <Form.Item
                      name="dosya"
                      label="Dosya Değiştir"
                      valuePropName="fileList"
                      getValueFromEvent={(e) =>
                        Array.isArray(e) ? e : e && e.fileList
                      }
                    >
                      <Upload
                        maxCount={1}
                        beforeUpload={() => false}
                        listType="picture"
                      >
                        <Button icon={<UploadOutlined />}>
                          Yeni Dosya Seç
                        </Button>
                      </Upload>
                    </Form.Item>
                    <Button
                      type="primary"
                      block
                      icon={<SaveOutlined />}
                      loading={formYukleniyor}
                      onClick={() => gorevGuncelle(detayForm.getFieldsValue())}
                    >
                      Değişiklikleri Kaydet
                    </Button>
                  </>
                )}
              </Form>

              {!duzenlemeModu && seciliGorev.dosya_yolu && (
                <div style={{ marginTop: 15 }}>
                  <Button
                    type="dashed"
                    block
                    icon={<PaperClipOutlined />}
                    href={`${API_URL}/uploads/${seciliGorev.dosya_yolu}`}
                    target="_blank"
                  >
                    Ekli Dosyayı Görüntüle
                  </Button>
                </div>
              )}

              <Divider />

              {/* ALT GÖREVLER */}
              <div
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Title level={5} style={{ margin: 0 }}>
                  <CheckSquareOutlined /> Alt Görevler
                </Title>
                <span style={{ color: "#999", fontSize: 12 }}>
                  {Math.round(
                    (altGorevler.filter((x) => x.durum).length /
                      (altGorevler.length || 1)) *
                      100
                  )}
                  % Tamamlandı
                </span>
              </div>
              <Progress
                percent={Math.round(
                  (altGorevler.filter((x) => x.durum).length /
                    (altGorevler.length || 1)) *
                    100
                )}
                strokeColor="#87d068"
                showInfo={false}
                style={{ marginBottom: 15 }}
              />
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
                    >
                      <span
                        style={{
                          textDecoration: item.durum ? "line-through" : "none",
                          color: item.durum ? "#ccc" : "black",
                        }}
                      >
                        {item.baslik}
                      </span>
                    </Checkbox>
                  </List.Item>
                )}
              />

              <Space.Compact style={{ width: "100%", marginTop: 10 }}>
                <Input
                  placeholder="Yeni alt adım ekle"
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
                <MessageOutlined /> İş Sohbeti
              </Title>
              <div
                style={{
                  height: "400px",
                  overflowY: "auto",
                  border: "1px solid #eee",
                  padding: 10,
                  borderRadius: 5,
                  marginBottom: 10,
                  background: "#fff",
                }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={yorumlar}
                  renderItem={(item) => (
                    <List.Item key={item.id}>
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ backgroundColor: "#1890ff" }}>
                            {item.yazan_kisi ? item.yazan_kisi[0] : "U"}
                          </Avatar>
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text strong>{item.yazan_kisi}</Text>{" "}
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
                  placeholder="Yorum yaz... (@ ile etiketle)"
                  value={yeniYorum}
                  onChange={(text) => setYeniYorum(text)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      yorumGonder();
                    }
                  }}
                  options={
                    kullanicilar &&
                    kullanicilar.map((k) => ({
                      value: k.ad_soyad,
                      label: k.ad_soyad,
                      key: k.id,
                    }))
                  }
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={yorumGonder}
                  style={{ marginTop: 10, float: "right" }}
                >
                  Gönder
                </Button>
              </div>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}
