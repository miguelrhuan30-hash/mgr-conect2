import { useEffect } from 'react';

/**
 * Landing pública MGR — site multi-página estático em /site/.
 * Substitui o componente SPA antigo. Mantemos esse wrapper só para
 * cobrir o caso de alguém aterrissar em "/" via SPA — redireciona
 * imediatamente para o site estático em public/site/.
 */
const LandingPage = () => {
  useEffect(() => {
    window.location.replace('/site/');
  }, []);
  return null;
};

export default LandingPage;
