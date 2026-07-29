import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/day-of-music/atoms";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — Day of Music",
  description: "Day of Music 개인정보 처리방침",
};

const EFFECTIVE_DATE = "2026년 7월 29일";

export default function PrivacyPage() {
  return (
    <div className="dom-stage">
      <div className="dom-root dom-legal-root" data-grid="1">
        <header className="dom-topbar dom-legal-topbar">
          <Link
            href="/"
            className="dom-brand"
            aria-label="Day of Music 홈으로 이동"
          >
            <BrandMark />
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </Link>
          <nav className="dom-legal-nav" aria-label="법적 고지">
            <Link href="/terms">이용약관</Link>
            <Link href="/" className="dom-legal-back">
              홈으로 돌아가기 →
            </Link>
          </nav>
        </header>

        <main className="dom-legal">
          <div className="dom-legal-heading">
            <p className="dom-signin-eyebrow">
              Privacy policy · 개인정보 처리방침
            </p>
            <h1>Day of Music 개인정보 처리방침</h1>
            <p>시행일 {EFFECTIVE_DATE}</p>
          </div>

          <div className="dom-legal-summary">
            <strong>핵심 내용을 먼저 알려드립니다.</strong>
            <p>
              데이오브뮤직은 계정과 음악 저널을 제공하는 데 필요한 정보만
              처리합니다. 감상 기록은 본인만 볼 수 있으며, 이용자가 직접 공유
              링크를 만든 경우에만 카드에 표시된 정보가 공개됩니다. 광고 목적의
              추적 도구는 사용하지 않습니다.
            </p>
          </div>

          <section>
            <h2>1. 총칙</h2>
            <p>
              데이오브뮤직(이하 &quot;회사&quot;)은 Day of Music 웹사이트,
              모바일 애플리케이션 및 이에 부수하는 서비스(이하
              &quot;서비스&quot;)를 제공하며, 「개인정보 보호법」 등 관련 법령에
              따라 이용자의 개인정보를 보호합니다. 이 처리방침은 서비스에서
              처리하는 개인정보의 항목, 목적, 보유기간과 이용자가 행사할 수 있는
              권리를 설명합니다.
            </p>
          </section>

          <section>
            <h2>2. 처리하는 개인정보의 항목·목적·보유기간</h2>
            <p>
              회사는 서비스 제공에 필요한 최소한의 개인정보를 아래와 같이
              처리합니다.
            </p>
            <div className="dom-legal-table-wrap">
              <table className="dom-legal-table">
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">처리 항목</th>
                    <th scope="col">처리 목적</th>
                    <th scope="col">보유기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">이메일 가입</th>
                    <td>이메일 주소, 암호화된 인증정보, 이용자 식별값</td>
                    <td>회원가입, 로그인, 본인 확인, 계정 보안</td>
                    <td>회원 탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <th scope="row">소셜 로그인</th>
                    <td>
                      Google 또는 Kakao가 제공하는 식별값, 이메일, 프로필 정보
                      중 로그인 제공자가 허용하고 이용자가 동의한 항목
                    </td>
                    <td>간편 회원가입과 로그인</td>
                    <td>회원 탈퇴 또는 소셜 계정 연결 해제 시까지</td>
                  </tr>
                  <tr>
                    <th scope="row">프로필</th>
                    <td>이용자명, 음악 스토어 국가 설정</td>
                    <td>프로필 표시, 국가별 음악 검색 결과 제공</td>
                    <td>회원 탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <th scope="row">음악 저널</th>
                    <td>
                      선택한 음악 정보, 기록 날짜, 별점, 감상 메모, 테마와 화면
                      설정
                    </td>
                    <td>음악 기록 저장·동기화, 주간·월간 보기와 통계 제공</td>
                    <td>회원 탈퇴 또는 이용자가 기록을 삭제할 때까지</td>
                  </tr>
                  <tr>
                    <th scope="row">공개 공유</th>
                    <td>
                      이용자명, 음악·날짜·별점·테마·통계 등 공유 카드에 표시되는
                      정보, 공유 링크 식별 토큰
                    </td>
                    <td>이용자가 요청한 공개 공유 링크 제공</td>
                    <td>회원 탈퇴 또는 공유 데이터 삭제 시까지</td>
                  </tr>
                  <tr>
                    <th scope="row">서비스 운영</th>
                    <td>
                      IP 주소, 접속 일시, 기기·브라우저 정보, 서비스 이용 및
                      오류 기록
                    </td>
                    <td>보안, 부정 이용 방지, 장애 대응과 서비스 품질 개선</td>
                    <td>
                      목적 달성 후 지체 없이 삭제하며, 법령상 보관 의무가 있는
                      경우 해당 기간
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="dom-legal-notes">
              <li>
                회사는 이용자가 입력한 비밀번호 원문을 열람하거나 별도로
                보관하지 않습니다. 인증정보는 인증 서비스 제공자인 Supabase에서
                보호된 형태로 처리됩니다.
              </li>
              <li>
                공개 공유 카드에는 감상 메모와 트랙 목록이 포함되지 않습니다.
                다만 이용자명, 음악 정보, 날짜, 별점과 통계는 링크를 아는 사람이
                볼 수 있습니다.
              </li>
              <li>
                게스트 기록은 원칙적으로 기기 또는 브라우저 안에서만 처리되며
                회사 서버에 계정 기록으로 저장되지 않습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. 개인정보의 수집 방법</h2>
            <ol>
              <li>
                이용자가 회원가입, 로그인, 프로필 및 음악 기록 화면에 직접 입력
              </li>
              <li>
                Google 또는 Kakao 로그인을 선택했을 때 해당 제공자로부터 전달
              </li>
              <li>서비스 이용 과정에서 서버와 기기에서 자동 생성</li>
              <li>이용자가 이미지 또는 공개 링크 공유 기능을 직접 실행</li>
            </ol>
          </section>

          <section>
            <h2>4. 개인정보의 제3자 제공과 공개 공유</h2>
            <ol>
              <li>
                회사는 원칙적으로 이용자의 개인정보를 제3자에게 판매하거나
                제공하지 않습니다.
              </li>
              <li>
                이용자가 공개 공유 링크를 만들면 링크에 포함된 공유 카드 정보가
                링크를 아는 사람에게 공개됩니다. 이는 이용자가 요청한 공유
                기능을 제공하기 위한 것이며, 링크를 받은 사람이 다시 전달할 수
                있으므로 생성 전에 공개될 내용을 확인해야 합니다.
              </li>
              <li>
                법령에 특별한 규정이 있거나 수사기관 등이 법령에 정해진 절차와
                방법에 따라 요청한 경우에는 법령이 허용하는 범위에서 정보를
                제공할 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>5. 개인정보 처리업무의 위탁과 외부 서비스</h2>
            <p>
              회사는 안정적인 서비스 제공을 위해 다음 사업자의 서비스를
              이용합니다.
            </p>
            <div className="dom-legal-table-wrap">
              <table className="dom-legal-table">
                <thead>
                  <tr>
                    <th scope="col">사업자</th>
                    <th scope="col">이용 목적</th>
                    <th scope="col">관련 정보</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Supabase, Inc.</th>
                    <td>회원 인증, 세션 관리, 데이터베이스 저장과 동기화</td>
                    <td>계정, 프로필, 음악 저널 및 공유 카드 정보</td>
                  </tr>
                  <tr>
                    <th scope="row">Google LLC</th>
                    <td>이용자가 선택한 Google 로그인 제공</td>
                    <td>로그인 식별값, 이메일 및 동의한 프로필 정보</td>
                  </tr>
                  <tr>
                    <th scope="row">주식회사 카카오</th>
                    <td>이용자가 선택한 Kakao 로그인 제공</td>
                    <td>로그인 식별값, 이메일 및 동의한 프로필 정보</td>
                  </tr>
                  <tr>
                    <th scope="row">Apple Inc.</th>
                    <td>iTunes 음악 검색과 앨범·트랙 정보 제공</td>
                    <td>검색어, 선택한 스토어 국가</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="dom-legal-section-note">
              각 외부 서비스가 자체적으로 처리하는 정보에는 해당 사업자의
              개인정보 처리방침이 적용될 수 있습니다. 회사는 위탁업무의 목적과
              범위를 벗어나 개인정보가 처리되지 않도록 필요한 사항을 확인하고
              관리합니다.
            </p>
          </section>

          <section>
            <h2>6. 개인정보의 국외 이전</h2>
            <p>
              회원 인증, 데이터 저장, 소셜 로그인 및 음악 검색 기능을 위해
              개인정보 또는 서비스 이용정보가 국외 사업자의 시스템을 통해 처리될
              수 있습니다.
            </p>
            <div className="dom-legal-table-wrap">
              <table className="dom-legal-table">
                <thead>
                  <tr>
                    <th scope="col">이전받는 자</th>
                    <th scope="col">국가</th>
                    <th scope="col">항목·목적</th>
                    <th scope="col">시기·방법</th>
                    <th scope="col">보유기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Supabase, Inc.</th>
                    <td>미국 및 운영 프로젝트에 설정된 데이터 저장 리전</td>
                    <td>계정·프로필·저널·공유 정보의 인증, 저장 및 동기화</td>
                    <td>서비스 이용 시 암호화된 네트워크로 전송</td>
                    <td>회원 탈퇴 또는 처리 목적 달성 시까지</td>
                  </tr>
                  <tr>
                    <th scope="row">Google LLC</th>
                    <td>미국 등 Google이 서비스를 제공하는 국가</td>
                    <td>Google 로그인을 선택한 이용자의 인증정보 처리</td>
                    <td>Google 로그인 이용 시 암호화된 네트워크로 전송</td>
                    <td>회원 탈퇴·연결 해제 또는 제공자 정책에 따른 기간</td>
                  </tr>
                  <tr>
                    <th scope="row">Apple Inc.</th>
                    <td>미국 등 Apple이 서비스를 제공하는 국가</td>
                    <td>검색어와 스토어 국가를 이용한 음악 정보 조회</td>
                    <td>음악 검색 시 암호화된 네트워크로 전송</td>
                    <td>Apple의 정책에 따른 기간</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="dom-legal-section-note">
              국외 이전은 서비스 제공 계약의 이행을 위해 필요한 처리위탁·보관을
              근거로 합니다. 국외 이전을 원하지 않는 이용자는 외부 로그인 대신
              이메일 로그인을 선택할 수 있으며, 데이터 저장을 포함한 이전을
              거부하려면 계정을 삭제하여 서비스 이용을 종료할 수 있습니다.
            </p>
          </section>

          <section>
            <h2>7. 개인정보의 파기</h2>
            <ol>
              <li>
                회사는 보유기간이 끝나거나 처리 목적이 달성되면 개인정보를 지체
                없이 파기합니다. 다른 법령에 따라 보관해야 하는 경우에는 해당
                정보만 분리하여 법정 기간 동안 보관합니다.
              </li>
              <li>
                회원이 프로필 화면에서 계정을 삭제하면 인증 계정, 음악 저널과
                계정에 연결된 공유 카드 데이터가 함께 삭제되며 복구할 수
                없습니다.
              </li>
              <li>
                전자적 파일은 복구하기 어려운 방법으로 삭제하고, 데이터베이스
                기록은 이용 중인 저장 시스템의 안전한 삭제 절차에 따라
                삭제합니다.
              </li>
              <li>
                이미 내려받거나 제3자가 별도로 저장한 공유 이미지는 계정 삭제로
                자동 삭제되지 않습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>8. 브라우저·기기 저장정보와 자동 수집 장치</h2>
            <ol>
              <li>
                웹 서비스는 로그인 세션, PKCE 인증정보, 마지막 활동 시각,
                이용자명, 스토어 국가, 테마·화면 설정 및 음악 데이터 캐시를
                브라우저의 로컬 저장소에 보관할 수 있습니다. 모바일 앱은 로그인
                세션을 기기의 앱 전용 저장영역에 보관할 수 있습니다.
              </li>
              <li>
                이러한 저장정보는 로그인 유지, 자동 로그아웃, 기기별 설정 유지와
                빠른 화면 표시를 위해 사용됩니다. 회사는 맞춤형 광고를 위한
                쿠키나 광고 식별자를 사용하지 않습니다.
              </li>
              <li>
                이용자는 브라우저 설정 또는 기기 설정에서 저장정보를 삭제하거나
                차단할 수 있습니다. 다만 차단 시 로그인 유지, 게스트 기록 또는
                설정 저장 기능이 정상적으로 작동하지 않을 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>9. 개인정보의 안전성 확보조치</h2>
            <ol>
              <li>
                이용자별 데이터 접근을 제한하는 데이터베이스 접근정책 적용
              </li>
              <li>전송 구간 암호화와 인증 세션 보호</li>
              <li>관리자 권한과 서버 전용 인증키의 클라이언트 노출 방지</li>
              <li>개인정보 접근권한의 최소화와 접근 통제</li>
              <li>장시간 활동이 없는 계정의 자동 로그아웃</li>
              <li>보안 취약점 점검과 관련 소프트웨어의 지속적인 업데이트</li>
            </ol>
          </section>

          <section>
            <h2>10. 정보주체의 권리와 행사방법</h2>
            <ol>
              <li>
                이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제,
                처리정지 및 동의 철회를 요구할 수 있습니다.
              </li>
              <li>
                프로필 화면에서 이용자명과 스토어 국가를 직접 확인·수정할 수
                있고, 음악 기록을 삭제하거나 회원 탈퇴를 통해 계정과 연결된
                정보를 삭제할 수 있습니다.
              </li>
              <li>
                직접 처리하기 어려운 요청은 아래 개인정보 보호 문의처로 접수할
                수 있습니다. 회사는 요청자가 본인 또는 정당한 대리인인지 확인한
                뒤 관련 법령이 정한 기간 안에 처리합니다.
              </li>
              <li>
                다른 법령에서 수집·보관을 요구하거나 타인의 권리를 침해할 우려가
                있는 경우에는 법령이 정하는 범위에서 권리 행사가 제한될 수
                있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>11. 만 14세 미만 아동의 개인정보</h2>
            <p>
              서비스는 만 14세 미만 아동을 대상으로 하지 않습니다. 회사가
              법정대리인의 동의 없이 만 14세 미만 아동의 개인정보가 수집된
              사실을 알게 된 경우 해당 계정과 개인정보를 지체 없이 삭제하는 등
              필요한 조치를 합니다.
            </p>
          </section>

          <section>
            <h2>12. 개인정보 보호 문의와 권익침해 구제</h2>
            <div className="dom-legal-contact">
              <p>
                <strong>개인정보 보호 담당</strong>
              </p>
              <p>
                이메일:{" "}
                <a href="mailto:dayofmusic365@gmail.com">dayofmusic365@gmail.com</a>
              </p>
            </div>
            <p>
              개인정보 침해에 대한 신고·상담 또는 분쟁조정이 필요한 경우 다음
              기관에 문의할 수 있습니다.
            </p>
            <ul className="dom-legal-remedies">
              <li>
                개인정보분쟁조정위원회 · 1833-6972 ·{" "}
                <a href="https://www.kopico.go.kr/">kopico.go.kr</a>
              </li>
              <li>
                개인정보침해 신고센터 · 118 ·{" "}
                <a href="https://privacy.kisa.or.kr/">privacy.kisa.or.kr</a>
              </li>
              <li>
                경찰청 사이버범죄 신고시스템 · 182 ·{" "}
                <a href="https://ecrm.police.go.kr/">ecrm.police.go.kr</a>
              </li>
            </ul>
          </section>

          <section>
            <h2>13. 처리방침의 변경</h2>
            <p>
              회사는 법령, 서비스 또는 개인정보 처리 내용의 변경에 따라 이
              처리방침을 수정할 수 있습니다. 변경 시 적용일과 주요 변경 내용을
              서비스 초기 화면 또는 연결 화면에 적용일 7일 전부터 알리며, 이용자
              권리에 중대한 변경이 있는 경우에는 30일 전에 알립니다.
            </p>
          </section>

          <footer className="dom-legal-document-footer">
            <p>공고일 및 시행일: {EFFECTIVE_DATE}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
