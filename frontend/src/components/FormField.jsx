import styles from './FormField.module.css';

function FormField({ label, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.req}> *</span>}
      </label>
      {children}
    </div>
  );
}

export const Input = ({ ...props }) => (
  <input className={styles.input} {...props} />
);

export const Select = ({ children, ...props }) => (
  <select className={styles.input} {...props}>
    {children}
  </select>
);

export const Textarea = ({ ...props }) => (
  <textarea className={`${styles.input} ${styles.textarea}`} {...props} />
);

export const FormRow = ({ children }) => (
  <div className={styles.row}>{children}</div>
);

export const FormActions = ({ children }) => (
  <div className={styles.actions}>{children}</div>
);

export const BtnPrimary = ({ children, ...props }) => (
  <button className={styles.btnPrimary} {...props}>{children}</button>
);

export const BtnSecondary = ({ children, ...props }) => (
  <button className={styles.btnSecondary} {...props}>{children}</button>
);

export default FormField;
