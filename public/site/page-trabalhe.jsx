// MGR · Trabalhe Conosco
const WHATS_T = 'https://wa.me/5519983073630';

function T_Nav() {
  return <MGRHeader active="trabalhe" />;
}

function T_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Trabalhe Conosco</span>
    </div>
  );
}

function T_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <T_Nav />
      <T_Crumb />
      <div className="pad" style={{ padding: '80px 56px 96px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="MGR" label="Carreiras" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 72, lineHeight: 0.98, letterSpacing: -2.2, color: '#fff', margin: 0 }}>
              Venha fazer parte da família MGR de <span style={{ color: MGR.laranja }}>especialistas em refrigeração.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 600 }}>
              Construa uma carreira técnica de verdade. Aqui técnico não é mão de obra — é parceiro de operação. Você aprende com quem tem mais de 20 anos de campo, evolui na MGR Academy e tem plano de carreira mapeado.
            </p>
            <a href="#form" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              Quero enviar meu currículo <Ico name="arrow" size={16} />
            </a>
          </div>
          <div style={{ position: 'relative', minHeight: 440, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/equipe-mgr.png" alt="Time MGR" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.8)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.6) 100%)' }} />
            <div style={{ position: 'absolute', left: 24, bottom: 24, fontFamily: MGR.mono, fontSize: 11, color: '#fff', letterSpacing: 1.5 }}>
              <span style={{ color: MGR.laranja }}>●</span> TIME MGR · INDAIATUBA/SP
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function T_PorQue() {
  const itens = [
    { i: 'arrow', t: 'Crescimento real', d: 'Plano de carreira mapeado. Quem entrega e estuda, evolui.' },
    { i: 'doc', t: 'Aprendizado com os melhores', d: 'Time liderado por técnico gestor com mais de 20 anos de campo em refrigeração de alta eficiência.' },
    { i: 'shield', t: 'Trabalho que importa', d: 'Você não fica em manutenção genérica. Atua em projetos críticos de indústrias, food service e logística — onde refrigeração é missão crítica.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="01" label="Por que a MGR" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Por que escolher a MGR?
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: MGR.cinzaMedio, marginTop: 20 }}>
          Refrigeração industrial é uma especialidade rara — e quem domina é disputado no mercado. Na MGR, você não fica parado no mesmo nível: a gente investe no seu crescimento técnico estruturado.
        </p>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {itens.map((d, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, padding: '32px 32px 36px', borderRadius: 6, borderTop: `3px solid ${MGR.acento}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento, marginBottom: 24 }}>
              <Ico name={d.i} size={22} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px', letterSpacing: -0.4 }}>{d.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function T_Beneficios() {
  const itens = [
    { i: 'check', t: 'Almoço fornecido', d: 'A MGR fornece o almoço em todos os dias trabalhados, no horário de refeição. Você não precisa se preocupar com isso.' },
    { i: 'doc', t: 'Vale-refeição em cartão', d: 'Cartão tipo crédito que funciona em qualquer maquininha. Liberdade para usar onde quiser, em qualquer estabelecimento.' },
    { i: 'shield', t: 'Premiação por assiduidade', d: 'Reconhecemos quem está presente, comprometido e mantém constância no trabalho.' },
    { i: 'arrow', t: 'Premiação para viagens operacionais', d: 'Bônus específico para quem encara as obras fora de base.' },
    { i: 'chart', t: 'MGR Academy', d: 'Programa de capacitação técnica próprio, com insígnias e plano de carreira.' },
    { i: 'gear', t: 'Equipamento e EPI próprios', d: 'Você não paga pelo que precisa para trabalhar.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="02" label="O que oferecemos" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Benefícios que respeitam quem trabalha em campo.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#e6ebf1' }}>
        {itens.map((d, i) => (
          <div key={i} style={{ background: '#fff', padding: '32px 32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(232,97,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento }}>
                <Ico name={d.i} size={18} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: MGR.grafite, margin: 0, letterSpacing: -0.3 }}>{d.t}</h3>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function T_Academy() {
  const pilares = [
    { c: MGR.azul, t: 'Apostila do Conhecimento', d: 'Material técnico estruturado, disponível no sistema MGR para estudo livre — você consulta quando quiser, no seu ritmo.' },
    { c: MGR.acento, t: 'Aulas Presenciais', d: 'Conduzidas pelo técnico gestor MGR — mais de 20 anos de campo em refrigeração de alta eficiência. Casos reais, atualizações de mercado e aprofundamento da apostila.' },
    { c: '#A03A1A', t: 'Prova de Validação', d: 'Quando você se sente pronto, agenda a prova teórica ou prática. Aprovação rende uma insígnia MGR — bronze, prata ou ouro.' },
  ];
  const insig = [
    { c: '#B36A33', t: 'Bronze', d: 'Domina o essencial do módulo' },
    { c: '#9CA3AF', t: 'Prata', d: 'Domina + aplica em campo' },
    { c: '#D4792A', t: 'Ouro', d: 'Domina, aplica e ensina' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 980, marginBottom: 56 }}>
        <SectionTag num="03" label="MGR Academy" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1.6, color: MGR.grafite, margin: 0, lineHeight: 1, maxWidth: 920 }}>
          O conhecimento técnico que <span style={{ color: MGR.acento }}>faz você crescer.</span>
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: MGR.cinzaMedio, marginTop: 24 }}>
          Programa interno de capacitação em refrigeração de alta eficiência. Do zero ao avançado, com material próprio, aula presencial e prova de validação.
        </p>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 64 }}>
        {pilares.map((p, i) => (
          <div key={i} style={{ background: '#fff', padding: '36px 32px 40px', borderRadius: 6, borderTop: `4px solid ${p.c}` }}>
            <div style={{ fontFamily: MGR.mono, fontSize: 11, color: p.c, letterSpacing: 1.5, fontWeight: 600, marginBottom: 12 }}>0{i + 1}</div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: MGR.grafite, margin: '0 0 14px', letterSpacing: -0.4 }}>{p.t}</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 8, padding: '40px 40px 44px' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.azul, letterSpacing: 1.5, fontWeight: 600, marginBottom: 24 }}>● INSÍGNIAS MGR</div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {insig.map((m, i) => (
            <div key={i} style={{ background: MGR.cinzaClaro, padding: '24px 28px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: m.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: MGR.mono, fontSize: 18, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                {m.t[0]}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: MGR.grafite, marginBottom: 2 }}>{m.t}</div>
                <div style={{ fontSize: 13, color: MGR.cinzaMedio, lineHeight: 1.4 }}>{m.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 19, lineHeight: 1.5, color: MGR.grafite, margin: '48px auto 24px', textAlign: 'center', maxWidth: 880, fontWeight: 500, letterSpacing: -0.3 }}>
        Suas insígnias ficam no seu perfil e fazem parte do seu plano de carreira. Crescer na MGR é uma equação simples: <span style={{ color: MGR.acento, fontWeight: 600 }}>performance em campo + conhecimento técnico = evolução real.</span>
      </p>
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: 'rgba(232,97,26,0.12)', color: MGR.acento, fontFamily: MGR.mono, fontSize: 11, padding: '6px 14px', borderRadius: 4, letterSpacing: 1.5, fontWeight: 600 }}>
          ● PROGRAMA EM IMPLEMENTAÇÃO · PRIMEIRO MÓDULO EM FASE FINAL
        </span>
      </div>
    </section>
  );
}

function T_Cultura() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 1100 }}>
        <SectionTag num="04" label="Cultura" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: '0 0 40px', lineHeight: 1.05 }}>
          Como a gente trabalha aqui.
        </h2>
        <p style={{ fontSize: 26, lineHeight: 1.45, color: MGR.grafite, fontWeight: 400, letterSpacing: -0.3, margin: 0 }}>
          <strong style={{ fontWeight: 600 }}>Cultura técnica brasileira com orgulho.</strong> Meritocracia técnica — quem entrega cresce, quem estuda cresce mais.
          <br /><br />
          <span style={{ color: MGR.cinzaMedio }}>Não terceirizamos serviço crítico. Não improvisamos. Não aceitamos atalho que compromete resultado.</span>
          <br /><br />
          Aqui você é <span style={{ color: MGR.acento, fontWeight: 600 }}>Especialista de Campo</span>, não "mão de obra". Você tem voz nas decisões técnicas, acesso ao gestor sênior, e a responsabilidade real pela continuidade dos parceiros.
        </p>
      </div>
    </section>
  );
}

function T_Perfis() {
  const itens = [
    { i: 'gear', t: 'Técnicos de refrigeração', d: 'Formados ou em formação, com vontade de evoluir tecnicamente.' },
    { i: 'doc', t: 'Auxiliares e ajudantes técnicos', d: 'Quem está começando e quer aprender do zero com quem domina.' },
    { i: 'chart', t: 'Profissionais de gestão técnica e administrativa', d: 'Quem quer fazer parte de uma operação estruturada e em crescimento.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="05" label="Perfis" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quem cabe na MGR.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
        {itens.map((d, i) => (
          <div key={i} style={{ background: '#fff', padding: '32px 32px 36px', borderRadius: 6, borderLeft: `3px solid ${MGR.azul}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(27,94,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.azul, marginBottom: 20 }}>
              <Ico name={d.i} size={20} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 600, color: MGR.grafite, margin: '0 0 10px', letterSpacing: -0.3 }}>{d.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: MGR.cinzaMedio, margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, maxWidth: 820, margin: 0 }}>
        Não tem experiência ainda? <strong style={{ color: MGR.grafite }}>A MGR Academy começa do zero.</strong> O que a gente pede é vontade de aprender, comprometimento e respeito pelo trabalho técnico.
      </p>
    </section>
  );
}

function T_Form() {
  const [state, setState] = React.useState({
    nome: '', email: '', telefone: '', cidade: '',
    area: '', exp: '', mensagem: '', lgpd: false,
    arquivo: null,
  });
  const [status, setStatus] = React.useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = React.useState('');
  const [drag, setDrag] = React.useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setState((s) => ({ ...s, [k]: v }));
  };

  const formatTel = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a && `(${a}`, a && a.length === 2 ? ') ' : '', b, c && '-' + c].filter(Boolean).join(''));
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const onFile = (file) => {
    if (!file) return;
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExt = /\.(pdf|doc|docx)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !validExt) {
      setErrMsg('Formato inválido. Aceitamos PDF, DOC ou DOCX.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrMsg('Arquivo maior que 5MB.');
      return;
    }
    setErrMsg('');
    setState((s) => ({ ...s, arquivo: file }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!state.lgpd) { setErrMsg('É necessário aceitar a política de privacidade.'); return; }
    if (!state.arquivo) { setErrMsg('Anexe seu currículo (PDF, DOC ou DOCX).'); return; }
    if (!window.mgrDb || !window.mgrStorage) {
      setErrMsg('Serviço temporariamente indisponível. Tente novamente em instantes.');
      return;
    }
    setErrMsg('');
    setStatus('loading');
    try {
      // 1) cria o doc primeiro (sem cvUrl) — pega o ID
      const docRef = await window.mgrDb.collection('candidatos').add({
        nomeCompleto: state.nome.trim(),
        email: state.email.trim(),
        telefone: state.telefone.trim(),
        cidade: state.cidade.trim(),
        areaInteresse: state.area,
        nivelExperiencia: state.exp,
        mensagem: state.mensagem.trim() || null,
        origem: 'site_trabalhe_conosco',
        status: 'novo',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 200),
      });

      // 2) upload do CV no Storage em candidatos/{id}/cv.{ext}
      const ext = (state.arquivo.name.match(/\.[^.]+$/) || ['.pdf'])[0];
      const path = `candidatos/${docRef.id}/cv${ext}`;
      const ref = window.mgrStorage.ref(path);
      await ref.put(state.arquivo, { contentType: state.arquivo.type || 'application/pdf' });
      const cvUrl = await ref.getDownloadURL();

      // 3) atualiza o doc com a URL do CV
      await docRef.update({
        cvUrl,
        cvNome: state.arquivo.name,
        cvTamanho: state.arquivo.size,
      });

      setStatus('success');
    } catch (err) {
      console.error('Falha ao enviar candidatura:', err);
      setStatus('error');
      setErrMsg('Não foi possível enviar agora. Tente novamente ou nos contate por e-mail.');
    }
  };

  const inputStyle = {
    width: '100%', padding: '14px 16px', fontSize: 15, fontFamily: MGR.sans,
    background: '#fff', border: '1px solid #d6dde5', borderRadius: 6, color: MGR.grafite,
    outline: 'none', transition: 'border-color .15s ease',
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: MGR.grafite, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 };

  if (status === 'success') {
    return (
      <section id="form" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
        <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', padding: '64px 56px', borderRadius: 8, borderTop: `4px solid ${MGR.sucesso || '#16A34A'}`, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', color: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Ico name="check" size={32} />
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: MGR.grafite, margin: '0 0 16px', letterSpacing: -0.6 }}>Currículo recebido!</h2>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>
            Obrigado pelo interesse na MGR. Vamos analisar sua candidatura e entrar em contato quando surgir uma vaga compatível com seu perfil.
          </p>
          <a href="index.html" style={{ marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 10, color: MGR.azul, fontWeight: 600, fontSize: 14 }}>
            Voltar para a home <Ico name="arrow" size={14} />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section id="form" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="06" label="Candidatura" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Envie seu currículo.
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: MGR.cinzaMedio, marginTop: 20 }}>
          Preencha os campos abaixo e anexe seu currículo. A gente analisa todas as candidaturas — quando surgir uma vaga compatível, entramos em contato.
        </p>
      </div>
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 8, padding: '48px 48px 56px', maxWidth: 1020 }}>
        {/* honeypot */}
        <input type="text" name="website" tabIndex="-1" autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />

        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}><Ico name="check" size={14} color={MGR.azul} /> Nome completo *</label>
            <input required minLength={3} value={state.nome} onChange={set('nome')} style={inputStyle} placeholder="Como você se chama?" />
          </div>
          <div>
            <label style={labelStyle}><Ico name="doc" size={14} color={MGR.azul} /> E-mail *</label>
            <input required type="email" value={state.email} onChange={set('email')} style={inputStyle} placeholder="seu@email.com" />
          </div>
          <div>
            <label style={labelStyle}><Ico name="arrow" size={14} color={MGR.azul} /> Telefone / WhatsApp *</label>
            <input required value={state.telefone} onChange={(e) => setState((s) => ({ ...s, telefone: formatTel(e.target.value) }))} style={inputStyle} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label style={labelStyle}><Ico name="shield" size={14} color={MGR.azul} /> Cidade onde mora *</label>
            <input required value={state.cidade} onChange={set('cidade')} style={inputStyle} placeholder="Indaiatuba/SP" />
          </div>
          <div>
            <label style={labelStyle}><Ico name="gear" size={14} color={MGR.azul} /> Área de interesse *</label>
            <select required value={state.area} onChange={set('area')} style={inputStyle}>
              <option value="">Selecione…</option>
              <option>Técnico de refrigeração</option>
              <option>Auxiliar técnico</option>
              <option>Gestão técnica</option>
              <option>Administrativo</option>
              <option>Outros</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}><Ico name="chart" size={14} color={MGR.azul} /> Nível de experiência *</label>
            <select required value={state.exp} onChange={set('exp')} style={inputStyle}>
              <option value="">Selecione…</option>
              <option>Iniciante</option>
              <option>1-3 anos</option>
              <option>3-5 anos</option>
              <option>5+ anos</option>
            </select>
          </div>
        </div>

        {/* Upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}><Ico name="doc" size={14} color={MGR.azul} /> Currículo (PDF, DOC ou DOCX · máx 5MB) *</label>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
              border: `2px dashed ${drag ? MGR.acento : '#d6dde5'}`,
              background: drag ? 'rgba(232,97,26,0.04)' : MGR.cinzaClaro,
              borderRadius: 8, cursor: 'pointer', transition: 'all .15s ease',
            }}
          >
            <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fff', color: MGR.acento, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ico name="arrow" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              {state.arquivo ? (
                <>
                  <div style={{ fontSize: 14, color: MGR.grafite, fontWeight: 600, marginBottom: 2 }}>{state.arquivo.name}</div>
                  <div style={{ fontSize: 12, color: MGR.cinzaMedio }}>{(state.arquivo.size / 1024).toFixed(0)} KB · clique para trocar</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: MGR.grafite, fontWeight: 600, marginBottom: 2 }}>Arraste seu currículo aqui ou clique para selecionar</div>
                  <div style={{ fontSize: 12, color: MGR.cinzaMedio }}>PDF, DOC ou DOCX · até 5MB</div>
                </>
              )}
            </div>
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}><Ico name="doc" size={14} color={MGR.azul} /> Mensagem (opcional)</label>
          <textarea
            value={state.mensagem}
            onChange={(e) => setState((s) => ({ ...s, mensagem: e.target.value.slice(0, 500) }))}
            style={{ ...inputStyle, minHeight: 110, resize: 'vertical', fontFamily: MGR.sans }}
            placeholder="Conte um pouco sobre você, sua experiência ou o que te traz à MGR…"
          />
          <div style={{ fontSize: 11, color: MGR.cinzaMedio, marginTop: 6, fontFamily: MGR.mono, textAlign: 'right' }}>
            {state.mensagem.length}/500
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28, cursor: 'pointer' }}>
          <input required type="checkbox" checked={state.lgpd} onChange={set('lgpd')} style={{ marginTop: 4, width: 18, height: 18, accentColor: MGR.acento, flexShrink: 0 }} />
          <span style={{ fontSize: 13, lineHeight: 1.55, color: MGR.cinzaMedio }}>
            Concordo que a MGR armazene meus dados para fins de processo seletivo, conforme <a href="#" style={{ color: MGR.azul, fontWeight: 500, borderBottom: `1px solid ${MGR.azul}` }}>Política de Privacidade</a>.
          </span>
        </label>

        {errMsg && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#B91C1C', padding: '14px 18px', borderRadius: 6, fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ico name="shield" size={16} /> {errMsg}
          </div>
        )}

        <button
          type="submit" disabled={status === 'loading'}
          style={{
            background: status === 'loading' ? MGR.cinzaMedio : MGR.acento, color: '#fff',
            padding: '20px 36px', fontSize: 15, fontWeight: 600, borderRadius: 8,
            border: 'none', cursor: status === 'loading' ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 12,
            fontFamily: MGR.sans, transition: 'transform .15s ease',
          }}
          onMouseEnter={(e) => { if (status !== 'loading') e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {status === 'loading' ? (
            <>
              <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              Enviando…
            </>
          ) : (
            <>Enviar candidatura <Ico name="arrow" size={16} /></>
          )}
        </button>
      </form>
    </section>
  );
}

function T_FAQ() {
  const faqs = [
    { q: 'Vocês têm vagas abertas agora?', a: 'Mantemos o canal sempre aberto. Quando surgir uma vaga compatível com seu perfil, entramos em contato.' },
    { q: 'Atendem fora de Indaiatuba?', a: 'Nossa base é Indaiatuba/SP. Para vagas técnicas, é necessário disponibilidade para deslocamentos em SP e região.' },
    { q: 'Aceitam quem está começando?', a: 'Sim. A MGR Academy começa do zero — o que pedimos é vontade de aprender e comprometimento.' },
    { q: 'Tem CLT?', a: 'Conforme a vaga. Trabalhamos com CLT e PJ a depender da função.' },
    { q: 'Como funciona a Academy para quem é contratado?', a: 'Você ganha acesso à apostila no primeiro dia. Aulas presenciais acontecem na cadência da implementação. Provas e insígnias ficam disponíveis sob demanda.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="07" label="FAQ" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Perguntas frequentes.
        </h2>
      </div>
      <div style={{ maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map((f, i) => (
          <details key={i} style={{ background: MGR.cinzaClaro, borderRadius: 6, border: `1px solid ${MGR.cinzaClaro}` }}>
            <summary style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: MGR.grafite }}>{f.q}</span>
              <span className="faq-icon" style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 300, flexShrink: 0 }}>+</span>
            </summary>
            <div style={{ padding: '0 28px 24px', fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio }}>{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function T_Footer() {
  return <MGRFooter />;
}

function T_FloatCTA() {
  return (
    <a href="#form" className="float-cta" style={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 30,
      background: MGR.acento, color: '#fff', padding: '16px 24px',
      borderRadius: 999, fontSize: 13, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 10,
      boxShadow: '0 14px 32px rgba(232,97,26,0.4)', fontFamily: MGR.sans,
    }}>
      <Ico name="arrow" size={14} /> Enviar currículo
    </a>
  );
}

function PageTrabalhe() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <T_Hero />
      <T_PorQue />
      <T_Beneficios />
      <T_Academy />
      <T_Cultura />
      <T_Perfis />
      <T_Form />
      <T_FAQ />
      <T_Footer />
      <T_FloatCTA />
    </div>
  );
}

Object.assign(window, { PageTrabalhe });
