// src/components/dashboard/modals/AttendanceModal.jsx
import React from "react";
import {
  Modal,
  Row,
  Col,
  Card,
  Statistic,
  List,
  Avatar,
  Tag,
  Badge,
  Button,
  Tooltip,
  Progress,
} from "antd";
import {
  ClockCircleOutlined,
  FieldTimeOutlined,
  UserOutlined,
  CalendarOutlined,
  AlertOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { API_URL } from "../../../config/constants";

export default function AttendanceModal({
  open,
  onClose,
  attendanceData,
  currentlyWorkingCount,
  onLeaveCount,
  dolulukYuzde,
}) {
  return (
    <Modal
      title={
        <span>
          <ClockCircleOutlined /> Günlük Mesai Özeti & Analiz{" "}
          <Tag color="processing" icon={<FieldTimeOutlined />}>
            {dayjs().format("DD.MM.YYYY")}
          </Tag>
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
      <Row gutter={[16, 16]}>
        {/* İSTATİSTİK KARTLARI */}
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Ofiste"
                  value={currentlyWorkingCount}
                  suffix={`/ ${attendanceData.totalStaff}`}
                  valueStyle={{ color: "#3f8600" }}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="İzinde"
                  value={onLeaveCount}
                  valueStyle={{ color: "#1890ff" }}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Giriş Yok"
                  value={attendanceData.absentNoLeave.length}
                  valueStyle={{ color: "#ff4d4f" }}
                  prefix={<AlertOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Geç Kalan"
                  value={attendanceData.lateArrivals.length}
                  valueStyle={{ color: "#faad14" }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* SOL SÜTUN */}
        <Col span={8}>
          {/* ŞU AN MESAİDE OLANLAR */}
          <Card
            title="✅ Aktif Çalışanlar"
            type="inner"
            headStyle={{ background: "#f6ffed", color: "#3f8600" }}
            extra={
              <Badge
                count={currentlyWorkingCount}
                style={{ backgroundColor: "#52c41a" }}
              />
            }
          >
            {attendanceData.currentlyWorking.length > 0 ? (
              <List
                dataSource={attendanceData.currentlyWorking}
                renderItem={(person) => {
                  const baslangic = dayjs(person.baslangic);
                  const calismaSuresi = dayjs().diff(baslangic, "minute");
                  const saat = Math.floor(calismaSuresi / 60);
                  const dakika = calismaSuresi % 60;

                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            src={
                              person.avatar
                                ? `${API_URL}/uploads/${person.avatar}`
                                : null
                            }
                            style={{ backgroundColor: "#87d068" }}
                          >
                            {person.ad_soyad?.[0]}
                          </Avatar>
                        }
                        title={
                          <div>
                            <strong>{person.ad_soyad}</strong>
                            <Tag
                              color="blue"
                              size="small"
                              style={{ marginLeft: 8 }}
                            >
                              {person.departman}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div>
                              <ClockCircleOutlined /> Giriş:{" "}
                              {baslangic.format("HH:mm")}
                            </div>
                            <div style={{ fontSize: 12, color: "#666" }}>
                              Çalışma: {saat > 0 ? `${saat} saat ` : ""}
                              {dakika} dakika
                            </div>
                          </div>
                        }
                      />
                      <Tag color="green">Aktif</Tag>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
                <UserOutlined style={{ fontSize: 48, marginBottom: 10 }} />
                <div>Şu anda aktif mesai yok.</div>
              </div>
            )}
          </Card>

          {/* İZİNDE OLANLAR */}
          <Card
            title="🏝️ İzindekiler"
            type="inner"
            style={{ marginTop: 15 }}
            headStyle={{ background: "#e6f7ff", color: "#1890ff" }}
          >
            {attendanceData.onLeaveToday?.length > 0 ? (
              <List
                dataSource={attendanceData.onLeaveToday}
                renderItem={(izin) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar style={{ backgroundColor: "#1890ff" }}>
                          {izin.talep_eden?.[0]}
                        </Avatar>
                      }
                      title={izin.talep_eden}
                      description={
                        <div>
                          <div>{izin.tur}</div>
                          <div style={{ fontSize: 11, color: "#666" }}>
                            {dayjs(izin.bitis_tarihi).format("DD.MM.YYYY")}{" "}
                            tarihine kadar
                          </div>
                        </div>
                      }
                    />
                    <Tag color="blue">İzinli</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: "center", color: "#999" }}>
                Bugün izinde olan yok.
              </div>
            )}
          </Card>
        </Col>

        {/* ORTA SÜTUN */}
        <Col span={8}>
          {/* GEÇ KALANLAR */}
          <Card
            title="🕗 Geç Kalanlar (>09:15)"
            type="inner"
            headStyle={{ background: "#fff7e6", color: "#faad14" }}
          >
            <List
              dataSource={attendanceData.lateArrivals}
              renderItem={(rec) => {
                const gecikmeDakika = dayjs(rec.baslangic).diff(
                  dayjs().set("hour", 9).set("minute", 15),
                  "minute"
                );
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          src={
                            rec.avatar
                              ? `${API_URL}/uploads/${rec.avatar}`
                              : null
                          }
                        >
                          {rec.ad_soyad[0]}
                        </Avatar>
                      }
                      title={rec.ad_soyad}
                      description={
                        <div>
                          <div>
                            Giriş: {dayjs(rec.baslangic).format("HH:mm")}
                          </div>
                          <div style={{ fontSize: 11, color: "#fa8c16" }}>
                            {gecikmeDakika} dakika geç kaldı
                          </div>
                        </div>
                      }
                    />
                    <Tag color="orange">Gecikme</Tag>
                  </List.Item>
                );
              }}
            />
            {attendanceData.lateArrivals.length === 0 && (
              <div style={{ color: "green", textAlign: "center" }}>
                Herkes vaktinde geldi. 👍
              </div>
            )}
          </Card>

          {/* MESAİ BAŞLATMAYANLAR */}
          <Card
            title="⚠️ Mesai Başlatmayanlar"
            type="inner"
            style={{ marginTop: 15 }}
            headStyle={{ background: "#fff2f0", color: "#cf1322" }}
          >
            <List
              dataSource={attendanceData.absentNoLeave}
              renderItem={(user) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        src={
                          user.avatar
                            ? `${API_URL}/uploads/${user.avatar}`
                            : null
                        }
                        style={{ backgroundColor: "#ff4d4f" }}
                      >
                        {user.ad_soyad[0]}
                      </Avatar>
                    }
                    title={user.ad_soyad}
                    description={
                      <div>
                        <Tag color="red">Giriş Yok</Tag>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#666",
                            marginTop: 4,
                          }}
                        >
                          {user.departman}
                        </div>
                      </div>
                    }
                  />
                  <Tooltip title="Uyarı Gönder">
                    <Button type="link" icon={<AlertOutlined />} size="small" />
                  </Tooltip>
                </List.Item>
              )}
            />
            {attendanceData.absentNoLeave.length === 0 && (
              <div style={{ color: "green", textAlign: "center" }}>
                Herkes mesaiye başladı! 🎉
              </div>
            )}
          </Card>
        </Col>

        {/* SAĞ SÜTUN */}
        <Col span={8}>
          {/* FAZLA MESAİ ŞAMPİYONLARI */}
          <Card
            title="🏆 Ayın Fazla Mesai Şampiyonları"
            type="inner"
            headStyle={{ background: "#f9f0ff", color: "#722ed1" }}
            extra={<TrophyOutlined style={{ color: "gold" }} />}
          >
            {attendanceData.overtimeLeaders.length > 0 ? (
              <List
                dataSource={attendanceData.overtimeLeaders}
                renderItem={(user, index) => (
                  <List.Item>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: 20,
                          marginRight: 15,
                          minWidth: 30,
                          textAlign: "center",
                          color:
                            index === 0
                              ? "gold"
                              : index === 1
                              ? "silver"
                              : "#cd7f32",
                        }}
                      >
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </div>
                      <Avatar
                        src={
                          user.avatar
                            ? `${API_URL}/uploads/${user.avatar}`
                            : null
                        }
                        size="large"
                        style={{ marginRight: 10 }}
                      >
                        {user.ad_soyad[0]}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold", fontSize: 14 }}>
                          {user.ad_soyad}
                        </div>
                        <div style={{ fontSize: 12, color: "#888" }}>
                          {user.departman || "Personel"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: "bold",
                            color: "#722ed1",
                          }}
                        >
                          {user.total_overtime} Saat
                        </div>
                        <div style={{ fontSize: 10, color: "#999" }}>
                          Fazla Mesai
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
                <TrophyOutlined style={{ fontSize: 48, marginBottom: 10 }} />
                <div>Bu ay için fazla mesai verisi bulunamadı.</div>
              </div>
            )}
          </Card>

          {/* OFİS DOLULUK ÖZETİ */}
          <Card
            style={{
              marginTop: 15,
              textAlign: "center",
              background: "linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)",
              border: "1px solid #d9d9d9",
            }}
          >
            <Statistic
              title="Anlık Ofis Doluluğu"
              value={dolulukYuzde}
              suffix="%"
              valueStyle={{
                color:
                  dolulukYuzde > 70
                    ? "#3f8600"
                    : dolulukYuzde > 40
                    ? "#faad14"
                    : "#ff4d4f",
                fontSize: 36,
              }}
            />
            <Progress
              percent={dolulukYuzde}
              status="active"
              strokeColor={
                dolulukYuzde > 70
                  ? "#3f8600"
                  : dolulukYuzde > 40
                  ? "#faad14"
                  : "#ff4d4f"
              }
              style={{ marginTop: 20 }}
            />

            <Row gutter={16} style={{ marginTop: 20 }}>
              <Col span={8}>
                <div style={{ fontSize: 12, color: "#666" }}>Mesaide</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#3f8600",
                  }}
                >
                  {currentlyWorkingCount}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 12, color: "#666" }}>İzinde</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#1890ff",
                  }}
                >
                  {onLeaveCount}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 12, color: "#666" }}>Giriş Yok</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  {attendanceData.absentNoLeave.length}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
}
