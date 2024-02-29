import { IonAlert } from "@ionic/react";
import './AlertCard.css';


interface IonAlertProps {
    isOpen: boolean;
    header: string;
    message: string;
    onDismiss: () => void;
  }

export const AlertCard: React.FunctionComponent<IonAlertProps> = ({isOpen, header, message, onDismiss}) => {

    return (
        <>
            <IonAlert
                isOpen={isOpen}
                onDidDismiss={onDismiss}
                header={header}
                message={message}
                buttons={['OK']}
                className="alert"
            />
        </>
    );
}
    
export default AlertCard;