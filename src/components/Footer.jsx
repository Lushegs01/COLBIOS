import { config, hasSupportContact } from '../config.js';
import { PayButton } from '../payments.jsx';
import { Mark } from './Icons.jsx';

/* A legal link with no URL configured renders as plain, non-focusable text
   rather than a link to a page that does not exist. */
function MaybeLink({ href, children }) {
  return href ? <a href={href}>{children}</a> : <a>{children}</a>;
}

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__top">
          <div className="foot__brand">
            <span className="brand">
              <span className="brand__mark"><Mark size={26} /></span>
              <span className="brand__text">
                <span className="brand__name">COLBIOS</span>
                <span className="brand__sub">{config.institutionShort} student payments</span>
              </span>
            </span>
            <p className="foot__blurb">
              The digital payment platform for student dues at {config.institutionName}.
            </p>
            <PayButton size="sm" />
          </div>

          <nav className="foot__cols" aria-label="Footer">
            <div className="foot__col">
              <h2 className="foot__h">Site</h2>
              <ul>
                <li><a href="#top">Home</a></li>
                <li><a href="#how">How It Works</a></li>
                <li><a href="#about">About COLBIOS</a></li>
                <li><a href="#faq">Help</a></li>
              </ul>
            </div>
            <div className="foot__col">
              <h2 className="foot__h">Legal</h2>
              <ul>
                <li><MaybeLink href={config.privacyUrl}>Privacy</MaybeLink></li>
                <li><MaybeLink href={config.termsUrl}>Terms</MaybeLink></li>
              </ul>
            </div>
            <div className="foot__col">
              <h2 className="foot__h">Support</h2>
              <div className="foot__support">
                {hasSupportContact ? (
                  <>
                    {config.supportEmail && <p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>}
                    {config.supportPhone && <p><a href={`tel:${config.supportPhone.replace(/\s+/g, '')}`}>{config.supportPhone}</a></p>}
                    {config.supportHours && <p>{config.supportHours}</p>}
                  </>
                ) : (
                  <p>Support is provided through the COLBIOS payment platform.</p>
                )}
              </div>
            </div>
          </nav>
        </div>

        <div className="foot__bottom">
          <p className="foot__legal">
            &copy; {new Date().getFullYear()} COLBIOS.
            {config.institutionRelationship ? ` ${config.institutionRelationship}` : ''}
          </p>
          <p className="foot__legal foot__legal--muted">
            This website provides information about COLBIOS and access to the COLBIOS payment
            platform. Payments are completed on the payment platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
