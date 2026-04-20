import { PageHeader } from '../ui/AppPrimitives'

function FormHeader({
  title,
  eyebrow = 'Form',
  description = null,
  onBack,
  className = '',
  backLabel = 'Kembali',
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      backAction={onBack}
      backLabel={backLabel}
      className={className}
    />
  )
}

export default FormHeader
