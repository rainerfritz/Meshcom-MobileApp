import { IonText } from "@ionic/react";
import Linkify from "linkify-react";


//<IonText id="msg-text">{msg.msgTXT}</IonText>


interface msgText {
    msgTxt:string
}

export const MsgTxtLink: React.FunctionComponent<msgText> = ({ msgTxt }) => {

    if(msgTxt.includes("https") || msgTxt.includes("http") || msgTxt.includes("www")){

        const options = {
            /* … */
          };

        return (
            <>
                <Linkify options={options}>
                   {msgTxt}
                </Linkify>
            </>
        )

    } else {

        return(
            <>
                <IonText>{msgTxt}</IonText>
            </>
            )

    }
}